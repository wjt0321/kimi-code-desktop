import {
  DesktopSessionPageSchema,
  DesktopSessionRuntimeSchema,
  DesktopSessionSchema,
  DesktopTaskSnapshotSchema,
  DesktopWorkspaceSchema,
  type ApprovalDecisionRequest,
  type CompactSessionRequest,
  type CreateTaskRequest,
  type DesktopCapabilityKey,
  type DesktopCapabilityState,
  type DesktopMessage,
  type DesktopModel,
  type DesktopSession,
  type DesktopSessionPage,
  type DesktopSessionRuntime,
  type DesktopTaskSnapshot,
  type DesktopWorkspace,
  type ForkSessionRequest,
  type ListSessionsRequest,
  type RemoveWorkspaceRequest,
  type RenameWorkspaceRequest,
  type QuestionDismissRequest,
  type QuestionResponseRequest,
  type RestoreSessionRequest,
  type UndoSessionRequest,
  type UpdateRuntimeRequest,
} from '../../shared/contracts';
import { LocalServiceRequestError } from './server-lifecycle';
import { projectTranscript } from './transcript-projector';

interface ServerRequestPort {
  request(path: string, init?: RequestInit): Promise<unknown>;
}

interface CapabilityObserverPort {
  observe(key: DesktopCapabilityKey, state: DesktopCapabilityState): void;
}

export class KimiDesktopClient {
  constructor(
    private readonly server: ServerRequestPort,
    private readonly capabilities?: CapabilityObserverPort,
  ) {}

  async request(path: string, init?: RequestInit): Promise<unknown> {
    return unwrapServerEnvelope(await this.server.request(path, init));
  }
  private async requestCapability(
    key: DesktopCapabilityKey,
    path: string,
    init?: RequestInit,
  ): Promise<unknown> {
    try {
      const value = await this.request(path, init);
      this.capabilities?.observe(key, 'supported');
      return value;
    } catch (error) {
      if (isUnsupportedCapability(error)) this.capabilities?.observe(key, 'unsupported');
      throw error;
    }
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

  async renameWorkspace(input: RenameWorkspaceRequest): Promise<DesktopWorkspace> {
    try {
      const data = await this.request(`/workspaces/${encodeURIComponent(input.workspaceId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.name }),
      });
      return toDesktopWorkspace(data);
    } catch (error) {
      if (isUnsupportedCapability(error)) throw new Error('当前 Kimi Code CLI 版本暂不支持重命名工作区。');
      throw error;
    }
  }

  async removeWorkspace(input: RemoveWorkspaceRequest): Promise<void> {
    try {
      await this.request(`/workspaces/${encodeURIComponent(input.workspaceId)}`, { method: 'DELETE' });
    } catch (error) {
      if (isUnsupportedCapability(error)) throw new Error('当前 Kimi Code CLI 版本暂不支持清除工作区。');
      throw error;
    }
  }

  async listSessionPage(input: ListSessionsRequest): Promise<DesktopSessionPage> {
    const query = [
      `page_size=${input.pageSize}`,
      'include_archive=false',
    ];
    if (input.workspaceId !== undefined) query.push(`workspace_id=${encodeURIComponent(input.workspaceId)}`);
    if (input.beforeId !== undefined) query.push(`before_id=${encodeURIComponent(input.beforeId)}`);
    const data = await this.request(`/sessions?${query.join('&')}`, undefined);
    const record = readRecord(data, '本地服务返回了不支持的任务分页响应');
    return DesktopSessionPageSchema.parse({
      items: readItems(record).map(toDesktopSession),
      hasMore: readBoolean(record.has_more) ?? false,
    });
  }

  async listSessions(): Promise<DesktopSession[]> {
    const data = await this.request('/sessions?page_size=80&include_archive=false');
    return readItems(data).map(toDesktopSession);
  }


  async listArchivedSessions(): Promise<DesktopSession[]> {
    const data = await this.request('/sessions?page_size=80&archived_only=true');
    return readItems(data).map(toDesktopSession);
  }

  async listModels(): Promise<DesktopModel[]> {
    const data = await this.request('/models');
    return readItems(data).flatMap(toDesktopModel);
  }


  async getSessionRuntime(sessionId: string): Promise<DesktopSessionRuntime> {
    const encodedSessionId = encodeURIComponent(sessionId);
    let status: unknown;
    try {
      status = await this.requestCapability('sessionRuntime', `/sessions/${encodedSessionId}/status`);
    } catch (error) {
      if (isUnsupportedCapability(error)) return unsupportedSessionRuntime();
      throw error;
    }

    let warnings: unknown[] = [];
    try {
      const warningData = readRecord(
        await this.requestCapability('sessionWarnings', `/sessions/${encodedSessionId}/warnings`),
        '本地服务返回了无效会话警告',
      );
      warnings = Array.isArray(warningData.warnings) ? warningData.warnings : [];
    } catch (error) {
      if (!isUnsupportedCapability(error)) throw error;
    }

    const record = readRecord(status, '本地服务返回了无效运行状态');
    return DesktopSessionRuntimeSchema.parse({
      available: true,
      model: readString(record.model) || undefined,
      thinkingLevel: readRequiredString(record.thinking_level, '本地服务返回了无效思考强度'),
      permission: record.permission,
      planMode: readRequiredBoolean(record.plan_mode, '本地服务返回了无效计划模式'),
      swarmMode: readRequiredBoolean(record.swarm_mode, '本地服务返回了无效群组模式'),
      contextTokens: readRequiredNonNegativeInteger(record.context_tokens, '本地服务返回了无效上下文用量'),
      maxContextTokens: readRequiredNonNegativeInteger(record.max_context_tokens, '本地服务返回了无效上下文上限'),
      contextUsage: record.context_usage,
      warnings: warnings.map(toDesktopSessionWarning),
    });
  }

  async updateSessionRuntime(input: UpdateRuntimeRequest): Promise<DesktopSessionRuntime> {
    const agentConfig: Record<string, unknown> = {};
    if (input.model !== undefined) agentConfig.model = input.model;
    if (input.thinkingLevel !== undefined) agentConfig.thinking = input.thinkingLevel;
    if (input.permission !== undefined) agentConfig.permission_mode = input.permission;
    if (input.planMode !== undefined) agentConfig.plan_mode = input.planMode;
    try {
      await this.request(`/sessions/${encodeURIComponent(input.sessionId)}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_config: agentConfig }),
      });
    } catch (error) {
      if (isUnsupportedCapability(error)) throw new Error('当前 Kimi Code CLI 版本暂不支持运行策略控制。');
      throw error;
    }
    return this.getSessionRuntime(input.sessionId);
  }

  async compactSession(input: CompactSessionRequest): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(input.sessionId)}:compact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.instruction === undefined ? {} : { instruction: input.instruction }),
    });
  }

  async undoSession(input: UndoSessionRequest): Promise<void> {
    await this.request(`/sessions/${encodeURIComponent(input.sessionId)}:undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: input.count }),
    });
  }

  async forkSession(input: ForkSessionRequest): Promise<DesktopSession> {
    const data = await this.request(`/sessions/${encodeURIComponent(input.sessionId)}:fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.title === undefined ? {} : { title: input.title }),
    });
    return toDesktopSession(data);
  }

  async restoreSession(input: RestoreSessionRequest): Promise<DesktopSession> {
    const data = await this.request(`/sessions/${encodeURIComponent(input.sessionId)}:restore`, { method: 'POST' });
    return toDesktopSession(data);
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
      this.requestCapability('transcript', `/sessions/${encodedSessionId}/transcript?agent_id=main`),
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
  return [{
    id,
    label,
    provider,
    contextWindow,
    capabilities: readStringArray(record?.capabilities),
    supportEfforts: readStringArray(record?.support_efforts),
    defaultEffort: readString(record?.default_effort),
    adaptiveThinking: readBoolean(record?.adaptive_thinking),
  }];
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


function toDesktopSessionWarning(value: unknown): unknown {
  const record = readRecord(value, '本地服务返回了无效会话警告');
  return {
    code: readRequiredString(record.code, '本地服务返回了无效会话警告'),
    message: readRequiredString(record.message, '本地服务返回了无效会话警告'),
    severity: record.severity,
  };
}

function unsupportedSessionRuntime(): DesktopSessionRuntime {
  return {
    available: false,
    thinkingLevel: 'off',
    permission: 'manual',
    planMode: false,
    swarmMode: false,
    contextTokens: 0,
    maxContextTokens: 0,
    contextUsage: 0,
    warnings: [],
  };
}

function isUnsupportedCapability(error: unknown): boolean {
  return error instanceof LocalServiceRequestError && (error.status === 404 || error.status === 405);
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


function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length === value.length ? items : undefined;
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
