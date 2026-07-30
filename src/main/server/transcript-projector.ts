import {
  DesktopTaskSnapshotSchema,
  type DesktopApproval,
  type DesktopQuestion,
  type DesktopTask,
  type DesktopTaskSnapshot,
  type DesktopTaskStatus,
  type DesktopTimelineEntry,
  type DesktopTodo,
} from '../../shared/contracts';

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
          const name = readString(frameRecord.name);
          const state = frameRecord.state;
          if (!name || (state !== 'running' && state !== 'done' && state !== 'error')) continue;
          const output = displayValue(frameRecord.output ?? frameRecord.error ?? frameRecord.progress);
          timeline.push({
            id: frameId,
            kind: 'tool',
            name,
            state,
            summary: toolSummary(name, state),
            output,
          });
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
    tasks.push({
      id,
      title: readString(record.description) ?? '后台任务',
      kind,
      state,
      outputTail: readString(record.outputTail) ?? '',
      error: readString(record.error),
      startedAt: readString(record.startedAt),
      endedAt: readString(record.endedAt),
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
    const id = readString(record.approval_id);
    const toolName = readString(record?.tool_name);
    const action = readString(record?.action);
    const createdAt = readString(record?.created_at);
    if (!id || !toolName || action === undefined || !createdAt) continue;
    approvals.push({
      id,
      kind: 'approval',
      toolName,
      action,
      summary: displayValue(record.tool_input_display) ?? action,
      createdAt,
      expiresAt: readString(record.expires_at),
    });
  }
  return approvals;
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

function toolSummary(name: string, state: 'running' | 'done' | 'error'): string {
  if (state === 'running') return `正在运行 ${name}`;
  if (state === 'done') return `${name} 已完成`;
  return `${name} 运行失败`;
}

function displayValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}
