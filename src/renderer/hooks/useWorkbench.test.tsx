import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopSession, DesktopTaskSnapshot, DesktopWorkspace } from '../../shared/contracts';
import { useWorkbench } from './useWorkbench';

const workspace: DesktopWorkspace = { id: 'ws_1', name: '示例仓库', root: 'C:\\repo', sessionCount: 1 };
const session: DesktopSession = {
  id: 'session-1',
  title: '修复登录',
  updatedAt: '2026-07-29T00:00:00.000Z',
  busy: true,
  cwd: 'C:\\repo',
  workspaceId: 'ws_1',
  pendingInteraction: 'none',
};
const snapshot: DesktopTaskSnapshot = {
  session,
  agentId: 'main',
  timeline: [],
  todos: [],
  tasks: [],
  approvals: [],
  questions: [],
  status: { phase: 'running' },
  seq: 1,
};

const desktopApi = {
  listWorkspaces: vi.fn<() => Promise<DesktopWorkspace[]>>(),
  listSessions: vi.fn<() => Promise<DesktopSession[]>>(),
  listModels: vi.fn<() => Promise<[]>>(),
  getTaskSnapshot: vi.fn<(sessionId: string) => Promise<DesktopTaskSnapshot>>(),
  watchTask: vi.fn<(input: { sessionId: string; agentId: string }) => Promise<void>>(),
  unwatchTask: vi.fn<(sessionId?: string) => Promise<void>>(),
  onTaskEvent: vi.fn<(listener: (event: { sessionId: string; kind: 'refresh'; seq?: number }) => void) => () => void>(),
  renameSession: vi.fn<(input: { sessionId: string; title: string }) => Promise<void>>(),
  archiveSession: vi.fn<(sessionId: string) => Promise<void>>(),
};

let taskListener: ((event: { sessionId: string; kind: 'refresh'; seq?: number }) => void) | undefined;

afterEach(() => vi.clearAllMocks());

beforeEach(() => {
  desktopApi.listWorkspaces.mockResolvedValue([workspace]);
  desktopApi.listSessions.mockResolvedValue([session]);
  desktopApi.listModels.mockResolvedValue([]);
  desktopApi.getTaskSnapshot.mockResolvedValue(snapshot);
  desktopApi.watchTask.mockResolvedValue();
  desktopApi.unwatchTask.mockResolvedValue();
  desktopApi.renameSession.mockResolvedValue();
  desktopApi.archiveSession.mockResolvedValue();
  desktopApi.onTaskEvent.mockImplementation((listener) => {
    taskListener = listener;
    return () => { taskListener = undefined; };
  });
  Object.defineProperty(window, 'desktop', { configurable: true, value: desktopApi });
});

describe('useWorkbench', () => {
  it('loads the selected task, watches it, and refreshes only after a matching task event', async () => {
    const { result } = renderHook(() => useWorkbench(true));

    await waitFor(() => expect(result.current.snapshot?.session.id).toBe('session-1'));
    expect(desktopApi.watchTask).toHaveBeenCalledWith({ sessionId: 'session-1', agentId: 'main' });

    act(() => taskListener?.({ sessionId: 'another-session', kind: 'refresh', seq: 2 }));
    expect(desktopApi.getTaskSnapshot).toHaveBeenCalledTimes(1);

    act(() => taskListener?.({ sessionId: 'session-1', kind: 'refresh', seq: 2 }));
    await waitFor(() => expect(desktopApi.getTaskSnapshot).toHaveBeenCalledTimes(2));
  });

  it('clears a task from another workspace when switching to an empty workspace', async () => {
    const emptyWorkspace: DesktopWorkspace = { id: 'ws_2', name: '空工作区', root: 'C:\empty', sessionCount: 0 };
    desktopApi.listWorkspaces.mockResolvedValue([workspace, emptyWorkspace]);
    const { result } = renderHook(() => useWorkbench(true));
    await waitFor(() => expect(result.current.selectedSession?.id).toBe('session-1'));

    act(() => result.current.actions.selectWorkspace('ws_2'));

    expect(result.current.selectedWorkspaceId).toBe('ws_2');
    expect(result.current.selectedSession).toBeUndefined();
  });

  it('renames and archives tasks through the desktop API then refreshes the overview', async () => {
    const { result } = renderHook(() => useWorkbench(true));
    await waitFor(() => expect(result.current.selectedSession?.id).toBe('session-1'));

    await act(async () => result.current.actions.renameTask('session-1', '新的标题'));
    expect(desktopApi.renameSession).toHaveBeenCalledWith({ sessionId: 'session-1', title: '新的标题' });

    await act(async () => result.current.actions.archiveTask('session-1'));
    expect(desktopApi.archiveSession).toHaveBeenCalledWith('session-1');
    expect(desktopApi.listSessions).toHaveBeenCalledTimes(3);
  });
});
