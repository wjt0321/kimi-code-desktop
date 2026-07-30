import type { DesktopSession } from '../../../shared/contracts';

export interface SessionPresentation {
  tone: 'idle' | 'running' | 'attention' | 'error';
  label: string;
}

export function filterSessions(sessions: DesktopSession[], query: string): DesktopSession[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return sessions;
  return sessions.filter((session) => [session.title, session.lastPrompt, session.cwd]
    .some((value) => value?.toLocaleLowerCase().includes(normalized)));
}

export function sessionPresentation(session: DesktopSession): SessionPresentation {
  if (session.pendingInteraction === 'approval') return { tone: 'attention', label: '等待审批' };
  if (session.pendingInteraction === 'question') return { tone: 'attention', label: '等待回答' };
  if (session.lastTurnReason === 'failed') return { tone: 'error', label: '失败' };
  if (session.busy) return { tone: 'running', label: '执行中' };
  if (session.lastTurnReason === 'cancelled') return { tone: 'idle', label: '已停止' };
  return { tone: 'idle', label: '就绪' };
}

export function formatSessionTime(value: string, now = new Date()): string {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '最近';
  const difference = Math.max(0, now.getTime() - time.getTime());
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  if (hours < 48) return '昨天';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(time);
}
