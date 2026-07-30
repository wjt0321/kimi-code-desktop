import type { DesktopSession, DesktopStatus, DesktopTaskSnapshot } from '../../../shared/contracts';

export type WorkbenchStatusTone = 'neutral' | 'ready' | 'running' | 'attention' | 'error';
export type WorkbenchStatusAction = 'choose-cli' | 'start-service' | 'retry-service' | 'open-context';

export interface WorkbenchStatusItem {
  readonly label: string;
  readonly detail: string;
  readonly tone: WorkbenchStatusTone;
  readonly action?: WorkbenchStatusAction;
}

export interface WorkbenchStatusSummary {
  readonly cli: WorkbenchStatusItem;
  readonly service: WorkbenchStatusItem;
  readonly task: WorkbenchStatusItem;
}

export function presentWorkbenchStatus(
  status: DesktopStatus,
  session: DesktopSession | undefined,
  snapshot: DesktopTaskSnapshot | undefined,
): WorkbenchStatusSummary {
  return {
    cli: presentCli(status),
    service: presentService(status),
    task: presentTask(session, snapshot),
  };
}

function presentCli(status: DesktopStatus): WorkbenchStatusItem {
  switch (status.cli.kind) {
    case 'ready':
      return { label: 'Kimi CLI 已就绪', detail: `版本 ${status.cli.version}`, tone: 'ready' };
    case 'checking':
      return { label: '正在检测 CLI', detail: '正在检查系统安装', tone: 'running' };
    case 'missing':
      return { label: '未找到 Kimi CLI', detail: '请选择本机 CLI 文件', tone: 'error', action: 'choose-cli' };
    case 'invalid':
      return { label: 'CLI 需要处理', detail: '当前 CLI 无法使用', tone: 'error', action: 'choose-cli' };
  }
}

function presentService(status: DesktopStatus): WorkbenchStatusItem {
  switch (status.server.kind) {
    case 'connected':
      return { label: '本机服务已连接', detail: '正在使用本地服务', tone: 'ready' };
    case 'starting':
      return { label: '正在连接本地服务', detail: '服务启动后会自动进入工作台', tone: 'running' };
    case 'failed':
      return { label: '服务连接失败', detail: '请重新启动本地服务', tone: 'error', action: 'retry-service' };
    case 'idle':
      return { label: '服务未启动', detail: '启动后即可创建和执行任务', tone: 'neutral', action: 'start-service' };
  }
}

function presentTask(session: DesktopSession | undefined, snapshot: DesktopTaskSnapshot | undefined): WorkbenchStatusItem {
  if (!session) return { label: '等待开始', detail: '打开工作区后创建一个任务', tone: 'neutral' };

  const attentionCount = (snapshot?.approvals.length ?? 0) + (snapshot?.questions.length ?? 0);
  if (session.pendingInteraction === 'approval' || snapshot?.approvals.length) {
    return {
      label: '等待你的审批',
      detail: `有 ${Math.max(attentionCount, 1)} 项操作需要确认`,
      tone: 'attention',
      action: 'open-context',
    };
  }
  if (session.pendingInteraction === 'question' || snapshot?.questions.length) {
    return {
      label: '等待你的回答',
      detail: `有 ${Math.max(attentionCount, 1)} 个问题需要回答`,
      tone: 'attention',
      action: 'open-context',
    };
  }
  if (session.lastTurnReason === 'failed') {
    return { label: '任务失败', detail: '请查看任务记录后继续', tone: 'error' };
  }
  if (session.busy || snapshot?.status.phase === 'running' || snapshot?.status.phase === 'streaming' || snapshot?.status.phase === 'tool') {
    return { label: '正在执行', detail: 'Kimi Code 正在处理当前任务', tone: 'running' };
  }
  if (session.lastTurnReason === 'completed') {
    return { label: '任务已完成', detail: '可以继续发送后续请求', tone: 'ready' };
  }
  if (session.lastTurnReason === 'cancelled') {
    return { label: '任务已停止', detail: '可以继续发送新的请求', tone: 'neutral' };
  }
  return { label: '等待你的请求', detail: '输入任务后按 Ctrl + Enter 发送', tone: 'neutral' };
}
