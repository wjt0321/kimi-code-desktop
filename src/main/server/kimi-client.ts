import {
  DesktopSessionSchema,
  DesktopTaskSnapshotSchema,
  DesktopWorkspaceSchema,
  type ApprovalDecisionRequest,
  type CreateTaskRequest,
  type DesktopMessage,
  type DesktopModel,
  type DesktopSession,
  type DesktopTaskSnapshot,
  type DesktopWorkspace,
  type QuestionDismissRequest,
  type QuestionResponseRequest,
} from '../../shared/contracts';
import { projectTranscript } from './transcript-projector';

interface ServerRequestPort {
  request(path: string, init?: RequestInit): Promise<unknown>;
}

export class KimiDesktopClient {
  constructor(private readonly server: ServerRequestPort) {}

  async request(path: string, init?: RequestInit): Promise<unknown> {
    return unwrapServerEnvelope(await this.server.request(path, init));
  }
  async listWorkspaces(): Promise<DesktopWorkspace[]> {
    const data = await this.request('/workspaces');
    return readItems(data).map(toDesktopWorkspace);
  }

  async createWorkspace(root: string): Promise<DesktopWorkspace> {
    const data = await this.request('/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root }),
    });
    return toDesktopWorkspace(data);
  }

  async listSessions(): Promise<DesktopSession[]> {
    const data = await this.request('/sessions?page_size=80&include_archive=false');
    return readItems(data).map(toDesktopSession);
  }

  async listModels(): Promise<DesktopModel[]> {
    const data = await this.request('/models');
    return readItems(data).flatMap(toDesktopModel);
  }

  async getSession(sessionId: string): Promise<DesktopSession> {
    const data = await this.request(`/sessions/${encodeURIComponent(sessionId)}`);
    return toDesktopSession(data);
  }

  async createTask(input: CreateTaskRequest): Promise<DesktopSession> {
    const body = input.target === 'workspace'
      ? { workspace_id: input.workspaceId, title: input.title }
      : { metadata: { cwd: input.cwd }, title: input.title };
    const data = await this.request('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return toDesktopSession(data);
  }

  async createSession(cwd: string): Promise<DesktopSession> {
    return this.createTask({ target: 'folder', cwd });
  }

  async getTaskSnapshot(sessionId: string): Promise<DesktopTaskSnapshot> {
    const encodedSessionId = encodeURIComponent(sessionId);
    const [session, transcript, approvals, questions] = await Promise.all([
      this.getSession(sessionId),
      this.request(`/sessions/${encodedSessionId}/transcript?agent_id=main`),
      this.request(`/sessions/${encodedSessionId}/approvals?status=pending`),
      this.request(`/sessions/${encodedSessionId}/questions?status=pending`),
    ]);
    return DesktopTaskSnapshotSchema.parse({
      session,
      ...projectTranscript(transcript, approvals, questions),
    });
  }

  async listMessages(sessionId: string): Promise<DesktopMessage[]> {
    const data = await this.request(`/sessions/${encodeURIComponent(sessionId)}/messages?page_size=120`);
    return readItems(data).map(toDesktopMessage);
  }

  async submitPrompt(sessionId: string, text: string, model: string): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(sessionId)}/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [{ type: 'text', text }], model }),
    });
  }

  async abort(sessionId: string): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(sessionId)}:abort`, { method: 'POST' });
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  }

  async archiveSession(sessionId: string): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(sessionId)}:archive`, { method: 'POST' });
  }

  async respondApproval(input: ApprovalDecisionRequest): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(input.sessionId)}/approvals/${encodeURIComponent(input.approvalId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: input.decision,
        feedback: input.feedback,
        selected_label: input.selectedLabel,
      }),
    });
  }

  async respondQuestion(input: QuestionResponseRequest): Promise<void> {
    const answers = Object.fromEntries(Object.entries(input.answers).map(([questionId, answer]) => [questionId, toWireQuestionAnswer(answer)]));
    await this.request(`/sessions/${encodeURIComponent(input.sessionId)}/questions/${encodeURIComponent(input.questionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, note: input.note }),
    });
  }

  async dismissQuestion(input: QuestionDismissRequest): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(input.sessionId)}/questions/${encodeURIComponent(input.questionId)}:dismiss`, {
      method: 'POST',
    });
  }
}

function unwrapServerEnvelope(value: unknown): unknown {
  const record = asRecord(value);
  if (!record || typeof record.code !== 'number') return value;
  if (record.code !== 0) throw new Error(readString(record.msg) ?? 'Kimi Code 本地服务拒绝了该请求。');
  return record.data;
}
function toDesktopWorkspace(value: unknown): DesktopWorkspace {
  const record = readRecord(value, '本地服务返回了不支持的工作区记录');
  return DesktopWorkspaceSchema.parse({
    id: readRequiredString(record.id, '本地服务返回了不支持的工作区记录'),
    name: readRequiredString(record.name, '本地服务返回了不支持的工作区记录'),
    root: readRequiredString(record.root, '本地服务返回了不支持的工作区记录'),
    sessionCount: readRequiredNonNegativeInteger(record.session_count, '本地服务返回了不支持的工作区记录'),
  });
}

function toDesktopModel(value: unknown): DesktopModel[] {
  const record = asRecord(value);
  const id = readString(record?.model);
  const label = readString(record?.display_name);
  const provider = readString(record?.provider);
  if (!id || !label || !provider) return [];
  const contextWindow = readRequiredPositiveInteger(record?.max_context_size);
  return [{ id, label, provider, contextWindow }];
}

function toDesktopSession(value: unknown): DesktopSession {
  const record = readRecord(value, '本地服务返回了无效任务');
  const metadata = asRecord(record.metadata) ?? {};
  const config = asRecord(record.agent_config) ?? {};
  return DesktopSessionSchema.parse({
    id: readRequiredString(record.id, '本地服务返回了无效任务'),
    title: readString(record.title) || '未命名任务',
    updatedAt: readRequiredString(record.updated_at, '本地服务返回了无效任务'),
    busy: readRequiredBoolean(record.busy, '本地服务返回了无效任务'),
    cwd: readString(metadata.cwd) ?? '',
    lastPrompt: readString(record.last_prompt),
    workspaceId: readString(record.workspace_id),
    pendingInteraction: readPendingInteraction(record.pending_interaction),
    lastTurnReason: readLastTurnReason(record.last_turn_reason),
    model: readString(config.model) || undefined,
    permission: readPermission(config.permission_mode ?? config.permission),
    mainTurnActive: readBoolean(record.main_turn_active),
  });
}

function toDesktopMessage(value: unknown): DesktopMessage {
  const record = readRecord(value, '本地服务返回了无效消息');
  const role = record.role;
  const content = record.content;
  if (!isMessageRole(role) || !Array.isArray(content)) throw new Error('本地服务返回了无效消息');
  return {
    id: readRequiredString(record.id, '本地服务返回了无效消息'),
    role,
    createdAt: readRequiredString(record.created_at, '本地服务返回了无效消息'),
    text: content.map(contentText).filter(Boolean).join('\n\n'),
  };
}

function readItems(value: unknown): unknown[] {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.items)) throw new Error('本地服务返回了不支持的响应');
  return record.items;
}

function toWireQuestionAnswer(answer: QuestionResponseRequest['answers'][string]): Record<string, unknown> {
  switch (answer.kind) {
    case 'single': return { kind: 'single', option_id: answer.optionId };
    case 'multi': return { kind: 'multi', option_ids: answer.optionIds };
    case 'other': return { kind: 'other', text: answer.text };
    case 'multi_with_other': return { kind: 'multi_with_other', option_ids: answer.optionIds, other_text: answer.otherText };
    case 'skipped': return { kind: 'skipped' };
  }
}

function contentText(value: unknown): string {
  const record = asRecord(value);
  if (!record) return '';
  if (record.type === 'text' && typeof record.text === 'string') return record.text;
  if (record.type === 'thinking' && typeof record.thinking === 'string') return record.thinking;
  if (record.type === 'tool_use' && typeof record.tool_name === 'string') return `正在运行 ${record.tool_name}`;
  if (record.type === 'tool_result') return typeof record.output === 'string' ? record.output : '工具已完成';
  return '';
}

function isMessageRole(value: unknown): value is DesktopMessage['role'] {
  return value === 'user' || value === 'assistant' || value === 'tool' || value === 'system';
}

function readRecord(value: unknown, message: string): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) throw new Error(message);
  return record;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readRequiredString(value: unknown, message: string): string {
  const result = readString(value);
  if (!result) throw new Error(message);
  return result;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readRequiredBoolean(value: unknown, message: string): boolean {
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readRequiredNonNegativeInteger(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(message);
  return value;
}

function readRequiredPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function readPendingInteraction(value: unknown): DesktopSession['pendingInteraction'] {
  return value === 'none' || value === 'approval' || value === 'question' ? value : undefined;
}

function readLastTurnReason(value: unknown): DesktopSession['lastTurnReason'] {
  return value === 'completed' || value === 'cancelled' || value === 'failed' ? value : undefined;
}

function readPermission(value: unknown): DesktopSession['permission'] {
  return value === 'manual' || value === 'yolo' || value === 'auto' ? value : undefined;
}
