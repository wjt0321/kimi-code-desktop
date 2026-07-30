import { describe, expect, it } from 'vitest';
import type { DesktopSession, DesktopWorkspace } from '../../shared/contracts';
import { mergeSessions, resolveNavigation, workspaceIdForSession } from './workbench-navigation';

const workspaces: DesktopWorkspace[] = [
  { id: 'a', name: 'A', root: 'C:\\a', sessionCount: 1 },
  { id: 'b', name: 'B', root: 'C:\\b', sessionCount: 1 },
];
const sessions: DesktopSession[] = [
  { id: 'sa', title: 'A task', cwd: 'C:\\a', workspaceId: 'a', updatedAt: '2026-07-29T00:00:00Z', busy: false },
  { id: 'sb', title: 'B task', cwd: 'C:\\b', workspaceId: 'b', updatedAt: '2026-07-30T00:00:00Z', busy: false },
];

describe('workbench navigation', () => {
  it('moves workspace and session atomically when a task belongs to another workspace', () => {
    expect(resolveNavigation(workspaces, sessions, 'a', 'sb')).toEqual({ workspaceId: 'b', sessionId: 'sb' });
  });

  it('keeps an explicitly selected empty workspace without leaking another task', () => {
    expect(resolveNavigation(workspaces, sessions.filter((item) => item.id === 'sa'), 'b')).toEqual({ workspaceId: 'b', sessionId: undefined });
  });

  it('matches legacy sessions by cwd and merges pages without duplicates', () => {
    expect(workspaceIdForSession({ ...sessions[0], workspaceId: undefined }, workspaces)).toBe('a');
    expect(mergeSessions(sessions, [{ ...sessions[0], title: 'updated' }])).toHaveLength(2);
    expect(mergeSessions(sessions, [{ ...sessions[0], title: 'updated' }]).find((item) => item.id === 'sa')?.title).toBe('updated');
  });
});
