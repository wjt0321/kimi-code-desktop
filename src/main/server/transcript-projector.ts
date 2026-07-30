import {
  DesktopTaskSnapshotSchema,
  type DesktopApproval,
  type DesktopApprovalBlock,
  type DesktopQuestion,
  type DesktopTask,
  type DesktopTaskSnapshot,
  type DesktopTaskStatus,
  type DesktopTimelineEntry,
  type DesktopTodo,
} from '../../shared/contracts';
import { buildToolDiff } from './diff-projector';
import { projectToolFrame } from './tool-projector';

export function projectTranscript(
  value: unknown,
  approvalsValue: unknown,
  questionsValue: unknown,
): Omit<DesktopTaskSnapshot, 'session'> {
  const source = requireRecord(value);
  const agentId = requireString(source.agent_id);
  const items = requireArray(source.items);

  return DesktopTaskSnapshotSchema.omit({ session: true }).parse({
    agentId,
    timeline: readTimeline(items),
    todos: readTodos(source.todos),
    tasks: readTasks(source.tasks),
    approvals: readApprovals(approvalsValue),
    questions: readQuestions(questionsValue),
    status: readStatus(source.meta),
    seq: readNonNegativeInteger(source.seq),
  });
}

function readTimeline(items: unknown[]): DesktopTimelineEntry[] {
  const timeline: DesktopTimelineEntry[] = [];

  for (const item of items) {
    const turn = asRecord(item);
    if (turn?.kind !== 'turn') continue;

    for (const step of asArray(turn.steps)) {
      const stepRecord = asRecord(step);
      const stepRunning = stepRecord?.state === 'running';
      for (const frame of asArray(stepRecord?.frames)) {
        const frameRecord = asRecord(frame);
        if (!frameRecord) continue;
        const frameId = readString(frameRecord.frameId);
        const kind = frameRecord?.kind;
        if (!frameId || typeof kind !== 'string') continue;

        if (kind === 'text') {
          const role = frameRecord.role;
          const text = readString(frameRecord.text);
          if ((role !== 'user' && role !== 'assistant') || text === undefined) continue;
          timeline.push({
            id: frameId,
            kind: 'text',
            role,
            text,
            state: role === 'assistant' && stepRunning ? 'streaming' : 'complete',
          });
          continue;
        }

        if (kind === 'thinking') {
          const text = readString(frameRecord.text);
          if (text === undefined) continue;
          timeline.push({ id: frameId, kind: 'thinking', text, state: stepRunning ? 'streaming' : 'complete' });
          continue;
        }

        if (kind === 'tool') {
          const projected = projectToolFrame(frameRecord);
          if (projected) timeline.push(projected);
          continue;
        }
        if (kind === 'notice') {
          const level = frameRecord.level;
          const text = readString(frameRecord.message);
          if ((level !== 'info' && level !== 'warning' && level !== 'error') || text === undefined) continue;
          timeline.push({ id: frameId, kind: 'notice', level, text });
        }
      }
    }
  }

  return timeline;
}

function readTodos(value: unknown): DesktopTodo[] {
  const todos: DesktopTodo[] = [];
  for (const todo of asArray(value)) {
    const todoRecord = asRecord(todo);
    if (!todoRecord) continue;
    const todoId = readString(todoRecord.todoId);
    if (!todoId) continue;
    for (const [index, item] of asArray(todoRecord.items).entries()) {
      const itemRecord = asRecord(item);
      const title = readString(itemRecord?.title);
      const status = itemRecord?.status;
      if (!title || (status !== 'pending' && status !== 'in_progress' && status !== 'done')) continue;
      todos.push({ id: `${todoId}:${index}`, title, status });
    }
  }
  return todos;
}

function readTasks(value: unknown): DesktopTask[] {
  const tasks: DesktopTask[] = [];
  for (const task of asArray(value)) {
    const record = asRecord(task);
    if (!record) continue;
    const id = readString(record.taskId);
    const kind = record?.kind;
    const state = record?.state;
    if (!id || (kind !== 'shell' && kind !== 'subagent' && kind !== 'tool' && kind !== 'other')) continue;
    if (state !== 'running' && state !== 'completed' && state !== 'failed' && state !== 'timed_out' && state !== 'killed' && state !== 'lost') continue;
    const stateReason = readString(record.stateReason);
    const outputTail = readString(record.outputTail) ?? '';
    const startedAt = readString(record.startedAt);
    const endedAt = readString(record.endedAt);
    tasks.push({
      id,
      title: readString(record.description) ?? '后台任务',
      kind,
      state,
      outputTail,
      detached: readBoolean(record.detached),
      agentId: readString(record.agentId),
      resultSummary: readString(record.resultSummary),
      error: readString(record.error),
      stateReason,
      activityHint: state === 'running' && /notification|通知/i.test(stateReason ?? '')
        ? 'waiting_notification'
        : state === 'running' && outputTail.trim().length > 0
          ? 'snapshot'
          : undefined,
      startedAt,
      endedAt,
      updatedAt: endedAt ?? startedAt,
    });
  }
  return tasks;
}

function readApprovals(value: unknown): DesktopApproval[] {
  const root = asRecord(value);
  const approvals: DesktopApproval[] = [];
  for (const item of asArray(root?.items)) {
    const record = asRecord(item);
    if (!record) continue;
    const id = readString(record.approval_id) ?? readString(record.approvalId);
    const toolName = readString(record.tool_name) ?? readString(record.toolName);
    const action = readString(record.action);
    const createdAt = readString(record.created_at) ?? readString(record.createdAt);
    if (!id || !toolName || action === undefined || !createdAt) continue;
    approvals.push({
      id,
      kind: 'approval',
      toolName,
      action,
      summary: approvalSummary(record.tool_input_display ?? record.toolInputDisplay, action),
      createdAt,
      expiresAt: readString(record.expires_at) ?? readString(record.expiresAt),
      toolCallId: readString(record.tool_call_id) ?? readString(record.toolCallId),
      agentId: readString(record.agent_id) ?? readString(record.agentId),
      block: readApprovalBlock(record.tool_input_display ?? record.toolInputDisplay, action, id),
    });
  }
  return approvals;
}

function readApprovalBlock(value: unknown, fallbackSummary: string, id: string): DesktopApprovalBlock {
  const record = asRecord(value);
  const kind = readString(record?.kind);
  if (kind === 'command') {
    const command = readString(record?.command);
    if (command) return { kind: 'shell', command, cwd: readString(record?.cwd), danger: readString(record?.description) };
  }
  if (kind === 'diff') {
    const path = readString(record?.path);
    const before = readString(record?.before);
    const after = readString(record?.after);
    if (path && before !== undefined && after !== undefined) {
      const target = buildToolDiff('Edit', { path, old_string: before, new_string: after }, undefined, id);
      if (target) return { kind: 'diff', path, diff: target.lines };
    }
  }
  if (kind === 'file_io') {
    const path = readString(record?.path);
    const operation = readString(record?.operation);
    if (path && operation === 'write' && readString(record?.content) !== undefined) {
      return { kind: 'file', path, content: readString(record?.content) ?? '' };
    }
    if (path && operation) return { kind: 'fileop', op: operation, path, detail: readString(record?.detail) };
  }
  if (kind === 'url_fetch') {
    const url = readString(record?.url);
    if (url) return { kind: 'url', method: readString(record?.method), url };
  }
  if (kind === 'search') {
    const query = readString(record?.query);
    if (query) return { kind: 'search', query, scope: readString(record?.scope) };
  }
  if (kind === 'todo_list') {
    const items = asArray(record?.items).flatMap((item) => {
      const entry = asRecord(item);
      const title = readString(entry?.title);
      const status = readString(entry?.status);
      return title && status ? [{ title, status }] : [];
    });
    if (items.length > 0) return { kind: 'todo', items };
  }
  if (kind === 'plan_review') {
    const plan = readString(record?.plan);
    if (plan) {
      const options = asArray(record?.options).flatMap((option) => {
        const entry = asRecord(option);
        const label = readString(entry?.label);
        return label ? [{ label, description: readString(entry?.description) }] : [];
      });
      return { kind: 'plan_review', plan, path: readString(record?.path), options: options.length > 0 ? options : undefined };
    }
  }
  if (kind === 'agent_call' || kind === 'skill_call' || kind === 'task' || kind === 'task_stop' || kind === 'goal_start') {
    const name = readString(record?.agent_name) ?? readString(record?.skill_name) ?? readString(record?.description) ?? readString(record?.objective) ?? kind;
    return { kind: 'invocation', kind2: kind, name, description: readString(record?.prompt) ?? readString(record?.task_description) };
  }
  if (kind === 'generic') {
    const summary = readString(record?.summary);
    if (summary !== undefined) return { kind: 'generic', summary };
  }
  return { kind: 'generic', summary: fallbackSummary };
}

function approvalSummary(value: unknown, fallback: string): string {
  const record = asRecord(value);
  return readString(record?.description)
    ?? readString(record?.summary)
    ?? readString(record?.command)
    ?? readString(record?.path)
    ?? readString(record?.query)
    ?? fallback;
}
function readQuestions(value: unknown): DesktopQuestion[] {
  const root = asRecord(value);
  const questions: DesktopQuestion[] = [];
  for (const item of asArray(root?.items)) {
    const record = asRecord(item);
    if (!record) continue;
    const id = readString(record.question_id);
    const createdAt = readString(record?.created_at);
    if (!id || !createdAt) continue;

    const entries = asArray(record.questions).flatMap((question) => {
      const questionRecord = asRecord(question);
      if (!questionRecord) return [];
      const questionId = readString(questionRecord.id);
      const text = readString(questionRecord?.question);
      const options = asArray(questionRecord?.options).flatMap((option) => {
        const optionRecord = asRecord(option);
        if (!optionRecord) return [];
        const optionId = readString(optionRecord.id);
        const label = readString(optionRecord?.label);
        if (!optionId || !label) return [];
        return [{ id: optionId, label, description: readString(optionRecord.description) }];
      });
      if (!questionId || !text || options.length < 2 || options.length > 4) return [];
      return [{
        id: questionId,
        question: text,
        header: readString(questionRecord.header),
        body: readString(questionRecord.body),
        options,
        multiSelect: readBoolean(questionRecord.multi_select),
        allowOther: readBoolean(questionRecord.allow_other),
        otherLabel: readString(questionRecord.other_label),
        otherDescription: readString(questionRecord.other_description),
      }];
    });

    if (entries.length > 0) questions.push({ id, kind: 'question', questions: entries, createdAt });
  }
  return questions;
}

function readStatus(value: unknown): DesktopTaskStatus {
  const meta = asRecord(value);
  const agent = asRecord(meta?.agent);
  const phase = asRecord(agent?.phase);
  const rawPhase = phase?.kind;
  const mappedPhase = rawPhase === 'idle'
    ? 'idle'
    : rawPhase === 'running' || rawPhase === 'retrying'
      ? 'running'
      : rawPhase === 'streaming'
        ? 'streaming'
        : rawPhase === 'tool_call'
          ? 'tool'
          : rawPhase === 'awaiting_approval'
            ? 'awaiting_approval'
            : rawPhase === 'interrupted'
              ? 'interrupted'
              : rawPhase === 'ended'
                ? 'ended'
                : 'unknown';
  const contextUsage = readNumber(agent?.contextUsage);

  return {
    model: readString(agent?.model),
    permission: readPermission(agent?.permission),
    phase: mappedPhase,
    contextUsage: contextUsage !== undefined && contextUsage >= 0 && contextUsage <= 1 ? contextUsage : undefined,
  };
}

function requireRecord(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) throw invalidTaskRecord();
  return record;
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw invalidTaskRecord();
  return value;
}

function requireString(value: unknown): string {
  const text = readString(value);
  if (!text) throw invalidTaskRecord();
  return text;
}

function invalidTaskRecord(): Error {
  return new Error('本地服务返回了不支持的任务记录');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function readPermission(value: unknown): DesktopTaskStatus['permission'] {
  return value === 'manual' || value === 'yolo' || value === 'auto' ? value : undefined;
}
