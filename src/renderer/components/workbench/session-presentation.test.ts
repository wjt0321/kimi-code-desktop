import { describe, expect, it } from 'vitest';

import type { DesktopSession } from '../../../shared/contracts';
import { filterSessions, formatSessionTime, sessionPresentation } from './session-presentation';

const base: DesktopSession = {
  id: 'session-1',
  title: '修复登录状态',
  updatedAt: '2026-07-30T01:00:00.000Z',
  busy: false,
  cwd: 'D:\\repo',
  lastPrompt: '检查 OAuth 回调',
};

describe('session presentation', () => {
  it('filters by title, prompt, and workspace path without case sensitivity', () => {
    const sessions = [base, { ...base, id: 'session-2', title: 'Build Release', cwd: 'D:\\desktop', lastPrompt: '打包应用' }];
    expect(filterSessions(sessions, 'oauth')).toEqual([base]);
    expect(filterSessions(sessions, 'DESKTOP')).toHaveLength(1);
    expect(filterSessions(sessions, '  ')).toEqual(sessions);
  });

  it('presents activity and relative timestamps in Chinese', () => {
    expect(sessionPresentation({ ...base, busy: true })).toMatchObject({ tone: 'running', label: '执行中' });
    expect(sessionPresentation({ ...base, pendingInteraction: 'question' })).toMatchObject({ tone: 'attention', label: '等待回答' });
    expect(sessionPresentation({ ...base, lastTurnReason: 'failed' })).toMatchObject({ tone: 'error', label: '失败' });
    expect(formatSessionTime('2026-07-30T01:55:00.000Z', new Date('2026-07-30T02:00:00.000Z'))).toBe('5 分钟前');
  });
});
