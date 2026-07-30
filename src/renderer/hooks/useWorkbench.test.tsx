import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopSession, DesktopSessionRuntime, DesktopTaskSnapshot, DesktopWorkspace } from '../../shared/contracts';
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
  listSessionPage: vi.fn(),
  createTask: vi.fn(),
  createWorkspace: vi.fn(),
  createWorkspaceFolder: vi.fn(),
  renameWorkspace: vi.fn(),
  removeWorkspace: vi.fn(),
  getTaskSnapshot: vi.fn<(sessionId: string) => Promise<DesktopTaskSnapshot>>(),
  watchTask: vi.fn<(input: { sessionId: string; agentId: string }) => Promise<void>>(),
  unwatchTask: vi.fn<(sessionId?: string) => Promise<void>>(),
  onTaskEvent: vi.fn<(listener: (event: { sessionId: string; kind: 'refresh'; seq?: number }) => void) => () => void>(),
  renameSession: vi.fn<(input: { sessionId: string; title: string }) => Promise<void>>(),
  archiveSession: vi.fn<(sessionId: string) => Promise<void>>(),
  listArchivedSessions: vi.fn<() => Promise<DesktopSession[]>>(),
  getSessionRuntime: vi.fn<(sessionId: string) => Promise<DesktopSessionRuntime>>(),
  updateSessionRuntime: vi.fn(),
  compactSession: vi.fn(),
  undoSession: vi.fn(),
  forkSession: vi.fn(),
  restoreSession: vi.fn(),
  respondApproval: vi.fn(),
};

let taskListener: ((event: { sessionId: string; kind: 'refresh'; seq?: number }) => void) | undefined;

afterEach(() => vi.clearAllMocks());

beforeEach(() => {
  desktopApi.listWorkspaces.mockResolvedValue([workspace]);
  desktopApi.listSessions.mockResolvedValue([session]);
  desktopApi.listModels.mockResolvedValue([]);
  desktopApi.listSessionPage.mockResolvedValue({ items: [], hasMore: false });
  desktopApi.createWorkspace.mockResolvedValue(workspace);
  desktopApi.renameWorkspace.mockImplementation(async ({ workspaceId, name }) => ({ ...workspace, id: workspaceId, name }));
  desktopApi.removeWorkspace.mockResolvedValue(undefined);
  desktopApi.getTaskSnapshot.mockResolvedValue(snapshot);
  desktopApi.watchTask.mockResolvedValue();
  desktopApi.unwatchTask.mockResolvedValue();
  desktopApi.renameSession.mockResolvedValue();
  desktopApi.archiveSession.mockResolvedValue();
  desktopApi.listArchivedSessions.mockResolvedValue([]);
  desktopApi.getSessionRuntime.mockResolvedValue({
    available: true,
    model: 'kimi-code/k3',
    thinkingLevel: 'high',
    permission: 'manual',
    planMode: false,
    swarmMode: false,
    contextTokens: 0,
    maxContextTokens: 128000,
    contextUsage: 0,
    warnings: [],
  });
  desktopApi.updateSessionRuntime.mockImplementation(async (input) => ({
    available: true,
    model: 'kimi-code/k3',
    thinkingLevel: input.thinkingLevel ?? 'high',
    permission: input.permission ?? 'manual',
    planMode: input.planMode ?? false,
    swarmMode: false,
    contextTokens: 0,
    maxContextTokens: 128000,
    contextUsage: 0,
    warnings: [],
  }));
  desktopApi.compactSession.mockResolvedValue(undefined);
  desktopApi.undoSession.mockResolvedValue(undefined);
  desktopApi.respondApproval.mockResolvedValue(undefined);
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

  it('selects a task and its workspace atomically', async () => {
    const workspaceB: DesktopWorkspace = { id: 'ws_2', name: '第二仓库', root: 'D:\\repo', sessionCount: 1 };
    const sessionB: DesktopSession = { ...session, id: 'session-2', title: '第二任务', cwd: 'D:\\repo', workspaceId: 'ws_2' };
    desktopApi.listWorkspaces.mockResolvedValue([workspace, workspaceB]);
    desktopApi.listSessions.mockResolvedValue([session, sessionB]);
    const { result } = renderHook(() => useWorkbench(true));
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));

    act(() => result.current.actions.selectTask('session-2'));

    expect(result.current.selectedWorkspaceId).toBe('ws_2');
    expect(result.current.selectedSessionId).toBe('session-2');
  });

  it('keeps the workspace chosen in the new-task request and opens the created task', async () => {
    const workspaceB: DesktopWorkspace = { id: 'ws_2', name: '第二仓库', root: 'D:\\repo', sessionCount: 0 };
    const created: DesktopSession = { ...session, id: 'created-b', title: 'B 任务', cwd: 'D:\\repo', workspaceId: 'ws_2', busy: false };
    desktopApi.listWorkspaces.mockResolvedValue([workspace, workspaceB]);
    desktopApi.listSessions.mockResolvedValue([session]);
    desktopApi.createTask.mockResolvedValue(created);
    const { result } = renderHook(() => useWorkbench(true));
    await waitFor(() => expect(result.current.workspaces).toHaveLength(2));

    await act(async () => { await result.current.actions.createTask({ target: 'workspace', workspaceId: 'ws_2', title: 'B 任务' }); });

    expect(result.current.selectedWorkspaceId).toBe('ws_2');
    expect(result.current.selectedSessionId).toBe('created-b');
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
    expect(desktopApi.listSessions.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('undoes the last turn and restores the latest user prompt as a composer draft', async () => {
    const idleSession = { ...session, busy: false };
    const idleSnapshot: DesktopTaskSnapshot = {
      ...snapshot,
      session: idleSession,
      timeline: [
        { id: 'u1', kind: 'text', role: 'user', text: '第一次请求', state: 'complete' },
        { id: 'a1', kind: 'text', role: 'assistant', text: '第一次回答', state: 'complete' },
        { id: 'u2', kind: 'text', role: 'user', text: '请重新检查测试', state: 'complete' },
      ],
      status: { phase: 'idle' },
    };
    desktopApi.listSessions.mockResolvedValue([idleSession]);
    desktopApi.getTaskSnapshot.mockResolvedValue(idleSnapshot);
    const { result } = renderHook(() => useWorkbench(true));
    await waitFor(() => expect(result.current.snapshot?.timeline).toHaveLength(3));

    await act(async () => { await result.current.actions.undoTask(); });

    expect(desktopApi.undoSession).toHaveBeenCalledWith({ sessionId: 'session-1', count: 1 });
    expect(result.current.composerDraft?.text).toBe('请重新检查测试');
  });

  it('forks, lists archived tasks, and restores an archived task', async () => {
    const idleSession = { ...session, busy: false };
    const forked = { ...idleSession, id: 'forked-1', title: '派生任务' };
    const archived = { ...idleSession, id: 'archived-1', title: '归档任务' };
    desktopApi.listSessions.mockResolvedValue([idleSession]);
    desktopApi.getTaskSnapshot.mockResolvedValue({ ...snapshot, session: idleSession, status: { phase: 'idle' } });
    desktopApi.forkSession.mockResolvedValue(forked);
    desktopApi.listArchivedSessions.mockResolvedValue([archived]);
    desktopApi.restoreSession.mockResolvedValue(archived);
    const { result } = renderHook(() => useWorkbench(true));
    await waitFor(() => expect(result.current.selectedSession?.busy).toBe(false));

    await act(async () => { await result.current.actions.forkTask('派生任务'); });
    expect(desktopApi.forkSession).toHaveBeenCalledWith({ sessionId: 'session-1', title: '派生任务' });
    expect(result.current.selectedSessionId).toBe('forked-1');

    await act(async () => { await result.current.actions.loadArchivedSessions(); });
    expect(result.current.archivedSessions).toEqual([archived]);
    await act(async () => { await result.current.actions.restoreTask('archived-1'); });
    expect(desktopApi.restoreSession).toHaveBeenCalledWith({ sessionId: 'archived-1' });
  });


  it('tracks pending approval decisions and reports whether submission succeeded', async () => {
    let resolveDecision!: () => void;
    desktopApi.respondApproval.mockImplementation(() => new Promise<void>((resolve) => { resolveDecision = resolve; }));
    const { result } = renderHook(() => useWorkbench(true));
    await waitFor(() => expect(result.current.selectedSession?.id).toBe('session-1'));

    let decision!: Promise<boolean>;
    act(() => { decision = result.current.actions.respondApproval({ sessionId: 'session-1', approvalId: 'approval-1', decision: 'approved', feedback: '已检查' }); });
    expect(result.current.pendingApprovalIds).toEqual(['approval-1']);
    expect(desktopApi.respondApproval).toHaveBeenCalledWith({ sessionId: 'session-1', approvalId: 'approval-1', decision: 'approved', feedback: '已检查' });

    await act(async () => { resolveDecision(); expect(await decision).toBe(true); });
    expect(result.current.pendingApprovalIds).toEqual([]);

    desktopApi.respondApproval.mockRejectedValueOnce(new Error('failed'));
    await act(async () => { expect(await result.current.actions.respondApproval({ sessionId: 'session-1', approvalId: 'approval-2', decision: 'rejected' })).toBe(false); });
    expect(result.current.pendingApprovalIds).toEqual([]);
    expect(result.current.error).toBe('无法提交审批决定。');
  });

  it('does not run structural actions while the selected task is busy', async () => {
    const { result } = renderHook(() => useWorkbench(true));
    await waitFor(() => expect(result.current.selectedSession?.busy).toBe(true));

    await act(async () => { await result.current.actions.compactTask('保留决策'); });
    await act(async () => { await result.current.actions.undoTask(); });
    await act(async () => { await result.current.actions.forkTask(); });

    expect(desktopApi.compactSession).not.toHaveBeenCalled();
    expect(desktopApi.undoSession).not.toHaveBeenCalled();
    expect(desktopApi.forkSession).not.toHaveBeenCalled();
    expect(result.current.error).toContain('任务运行时');
  });

});
