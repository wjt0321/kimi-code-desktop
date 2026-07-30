import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ApprovalDecisionRequest,
  CreateTaskRequest,
  DesktopModel,
  DesktopSession,
  DesktopTaskSnapshot,
  DesktopWorkspace,
  QuestionDismissRequest,
  QuestionResponseRequest,
} from '../../shared/contracts';
import { mergeSessions, resolveNavigation, sessionsForWorkspace, workspaceIdForSession } from './workbench-navigation';
import { useSessionRuntime } from './useSessionRuntime';

export function useWorkbench(connected: boolean) {
  const [workspaces, setWorkspaces] = useState<DesktopWorkspace[]>([]);
  const [sessions, setSessions] = useState<DesktopSession[]>([]);
  const [models, setModels] = useState<DesktopModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [snapshot, setSnapshot] = useState<DesktopTaskSnapshot>();
  const [archivedSessions, setArchivedSessions] = useState<DesktopSession[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [composerDraft, setComposerDraft] = useState<{ revision: number; text: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingApprovalIds, setPendingApprovalIds] = useState<string[]>([]);
  const [workspacePages, setWorkspacePages] = useState<Record<string, { loading: boolean; hasMore: boolean; error?: string }>>({});
  const selectedSessionIdRef = useRef(selectedSessionId);
  const selectedWorkspaceIdRef = useRef(selectedWorkspaceId);
  const workspacesRef = useRef(workspaces);
  const sessionsRef = useRef(sessions);
  const snapshotRevision = useRef(0);
  const overviewRevision = useRef(0);
  const overviewTimer = useRef<number | undefined>(undefined);
  selectedSessionIdRef.current = selectedSessionId;
  selectedWorkspaceIdRef.current = selectedWorkspaceId;
  workspacesRef.current = workspaces;
  sessionsRef.current = sessions;
  const {
    runtime,
    loading: runtimeLoading,
    updating: runtimeUpdating,
    error: runtimeError,
    refresh: refreshRuntime,
    scheduleRefresh: scheduleRuntimeRefresh,
    update: updateSessionRuntime,
  } = useSessionRuntime(connected, selectedSessionId);

  const refreshOverview = useCallback(async () => {
    if (!connected) return;
    const revision = ++overviewRevision.current;
    try {
      const [nextWorkspaces, nextSessions, nextModels] = await Promise.all([
        window.desktop.listWorkspaces(),
        window.desktop.listSessions(),
        window.desktop.listModels().catch(() => []),
      ]);
      if (revision !== overviewRevision.current) return;
      const mergedSessions = mergeSessions(nextSessions, sessionsRef.current.filter((session) =>
        nextWorkspaces.some((workspace) => workspace.id === workspaceIdForSession(session, nextWorkspaces))));
      const navigation = resolveNavigation(
        nextWorkspaces,
        mergedSessions,
        selectedWorkspaceIdRef.current,
        selectedSessionIdRef.current,
      );
      workspacesRef.current = nextWorkspaces;
      sessionsRef.current = mergedSessions;
      selectedWorkspaceIdRef.current = navigation.workspaceId;
      selectedSessionIdRef.current = navigation.sessionId;
      setWorkspaces(nextWorkspaces);
      setSessions(mergedSessions);
      setModels(nextModels);
      setSelectedWorkspaceId(navigation.workspaceId);
      setSelectedSessionId(navigation.sessionId);
      setError(undefined);
    } catch {
      if (revision === overviewRevision.current) setError('无法加载本地服务中的工作区和任务。');
    }
  }, [connected]);

  const refreshSnapshot = useCallback(async (sessionId: string) => {
    const revision = ++snapshotRevision.current;
    try {
      const next = await window.desktop.getTaskSnapshot(sessionId);
      if (revision !== snapshotRevision.current || selectedSessionIdRef.current !== sessionId) return;
      setSnapshot(next);
      setError(undefined);
      await window.desktop.watchTask({ sessionId, agentId: next.agentId });
    } catch {
      if (revision === snapshotRevision.current && selectedSessionIdRef.current === sessionId) {
        setError('无法读取当前任务的执行过程。');
      }
    }
  }, []);

  const applySelection = useCallback((workspaceId: string | undefined, sessionId: string | undefined) => {
    const previous = selectedSessionIdRef.current;
    selectedWorkspaceIdRef.current = workspaceId;
    selectedSessionIdRef.current = sessionId;
    setSelectedWorkspaceId(workspaceId);
    setSelectedSessionId(sessionId);
    if (previous !== sessionId) {
      snapshotRevision.current += 1;
      setSnapshot(undefined);
      setSelectedModelId(undefined);
      if (previous) void window.desktop.unwatchTask(previous);
    }
  }, []);

  const selectTask = useCallback((sessionId: string) => {
    const session = sessionsRef.current.find((item) => item.id === sessionId);
    if (!session) return;
    applySelection(workspaceIdForSession(session, workspacesRef.current) ?? selectedWorkspaceIdRef.current, sessionId);
  }, [applySelection]);

  const selectWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspacesRef.current.find((item) => item.id === workspaceId);
    if (!workspace) return;
    applySelection(workspaceId, sessionsForWorkspace(workspace, sessionsRef.current)[0]?.id);
  }, [applySelection]);

  const chooseWorkspaceFolder = useCallback(async () => {
    try {
      return await window.desktop.chooseWorkspaceFolder();
    } catch {
      setError('无法打开本机文件夹选择器。');
      return null;
    }
  }, []);

  const createWorkspace = useCallback(async (root: string) => {
    try {
      const workspace = await window.desktop.createWorkspace({ root });
      const nextWorkspaces = [...workspacesRef.current.filter((item) => item.id !== workspace.id), workspace];
      workspacesRef.current = nextWorkspaces;
      setWorkspaces(nextWorkspaces);
      applySelection(workspace.id, undefined);
      void refreshOverview();
      return workspace;
    } catch {
      setError('无法添加这个工作区文件夹。');
      return undefined;
    }
  }, [applySelection, refreshOverview]);

  const createWorkspaceFolder = useCallback(async (name: string) => {
    try {
      const workspace = await window.desktop.createWorkspaceFolder({ name });
      if (!workspace) return undefined;
      const nextWorkspaces = [...workspacesRef.current.filter((item) => item.id !== workspace.id), workspace];
      workspacesRef.current = nextWorkspaces;
      setWorkspaces(nextWorkspaces);
      applySelection(workspace.id, undefined);
      void refreshOverview();
      return workspace;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法创建工作区文件夹。');
      return undefined;
    }
  }, [applySelection, refreshOverview]);

  const renameWorkspace = useCallback(async (workspaceId: string, name: string) => {
    try {
      const workspace = await window.desktop.renameWorkspace({ workspaceId, name });
      const next = workspacesRef.current.map((item) => item.id === workspace.id ? workspace : item);
      workspacesRef.current = next;
      setWorkspaces(next);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法重命名工作区。');
      return false;
    }
  }, []);

  const removeWorkspace = useCallback(async (workspaceId: string) => {
    try {
      await window.desktop.removeWorkspace({ workspaceId });
      const nextWorkspaces = workspacesRef.current.filter((item) => item.id !== workspaceId);
      const nextSessions = sessionsRef.current.filter((session) => workspaceIdForSession(session, workspacesRef.current) !== workspaceId);
      workspacesRef.current = nextWorkspaces;
      sessionsRef.current = nextSessions;
      setWorkspaces(nextWorkspaces);
      setSessions(nextSessions);
      const navigation = resolveNavigation(nextWorkspaces, nextSessions, selectedWorkspaceIdRef.current === workspaceId ? undefined : selectedWorkspaceIdRef.current, selectedSessionIdRef.current);
      applySelection(navigation.workspaceId, navigation.sessionId);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法从列表清除工作区。');
      return false;
    }
  }, [applySelection]);

  const createTask = useCallback(async (input?: CreateTaskRequest) => {
    try {
      const next = await window.desktop.createTask(input);
      if (!next) return undefined;
      const nextSessions = mergeSessions(sessionsRef.current, [next]);
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);
      const workspaceId = workspaceIdForSession(next, workspacesRef.current)
        ?? (input?.target === 'workspace' ? input.workspaceId : selectedWorkspaceIdRef.current);
      applySelection(workspaceId, next.id);
      void refreshOverview();
      return next;
    } catch {
      setError('无法创建任务，请检查本地服务和工作区路径。');
      return undefined;
    }
  }, [applySelection, refreshOverview]);

  const loadMoreWorkspaceSessions = useCallback(async (workspaceId: string) => {
    const workspace = workspacesRef.current.find((item) => item.id === workspaceId);
    if (!workspace) return;
    const existing = sessionsForWorkspace(workspace, sessionsRef.current);
    setWorkspacePages((current) => ({ ...current, [workspaceId]: { ...current[workspaceId], loading: true, hasMore: current[workspaceId]?.hasMore ?? workspace.sessionCount > existing.length, error: undefined } }));
    try {
      const page = await window.desktop.listSessionPage({ workspaceId, pageSize: 20, beforeId: existing.at(-1)?.id });
      const nextSessions = mergeSessions(sessionsRef.current, page.items);
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);
      setWorkspacePages((current) => ({ ...current, [workspaceId]: { loading: false, hasMore: page.hasMore } }));
    } catch {
      setWorkspacePages((current) => ({ ...current, [workspaceId]: { loading: false, hasMore: current[workspaceId]?.hasMore ?? true, error: '无法读取更多任务。' } }));
    }
  }, []);

  const sendPrompt = useCallback(async (text: string, model: string) => {
    const sessionId = selectedSessionIdRef.current;
    if (!sessionId) return;
    try {
      await window.desktop.submitPrompt({ sessionId, text, model });
      await Promise.all([refreshOverview(), refreshSnapshot(sessionId)]);
    } catch {
      setError('无法将请求发送给 Kimi Code。');
    }
  }, [refreshOverview, refreshSnapshot]);

  const abort = useCallback(async () => {
    const sessionId = selectedSessionIdRef.current;
    if (!sessionId) return;
    try {
      await window.desktop.abortSession(sessionId);
      await Promise.all([refreshOverview(), refreshSnapshot(sessionId)]);
    } catch {
      setError('无法停止当前任务。');
    }
  }, [refreshOverview, refreshSnapshot]);

  const respondApproval = useCallback(async (input: ApprovalDecisionRequest): Promise<boolean> => {
    setPendingApprovalIds((current) => current.includes(input.approvalId) ? current : [...current, input.approvalId]);
    try {
      await window.desktop.respondApproval(input);
      await Promise.all([refreshOverview(), refreshSnapshot(input.sessionId)]);
      return true;
    } catch {
      setError('无法提交审批决定。');
      return false;
    } finally {
      setPendingApprovalIds((current) => current.filter((approvalId) => approvalId !== input.approvalId));
    }
  }, [refreshOverview, refreshSnapshot]);

  const respondQuestion = useCallback(async (input: QuestionResponseRequest) => {
    try {
      await window.desktop.respondQuestion(input);
      await Promise.all([refreshOverview(), refreshSnapshot(input.sessionId)]);
    } catch {
      setError('无法提交回答。');
    }
  }, [refreshOverview, refreshSnapshot]);

  const dismissQuestion = useCallback(async (input: QuestionDismissRequest) => {
    try {
      await window.desktop.dismissQuestion(input);
      await Promise.all([refreshOverview(), refreshSnapshot(input.sessionId)]);
    } catch {
      setError('无法暂不处理这个问题。');
    }
  }, [refreshOverview, refreshSnapshot]);


  const renameTask = useCallback(async (sessionId: string, title: string) => {
    try {
      await window.desktop.renameSession({ sessionId, title });
      setSessions((current) => current.map((session) => session.id === sessionId ? { ...session, title } : session));
      setSnapshot((current) => current?.session.id === sessionId
        ? { ...current, session: { ...current.session, title } }
        : current);
      await refreshOverview();
    } catch {
      setError('无法重命名这个任务。');
    }
  }, [refreshOverview]);

  const archiveTask = useCallback(async (sessionId: string) => {
    try {
      await window.desktop.archiveSession(sessionId);
      const nextSessions = sessionsRef.current.filter((session) => session.id !== sessionId);
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);
      if (selectedSessionIdRef.current === sessionId) {
        const navigation = resolveNavigation(workspacesRef.current, nextSessions, selectedWorkspaceIdRef.current);
        applySelection(navigation.workspaceId, navigation.sessionId);
      }
      await refreshOverview();
    } catch {
      setError('无法归档这个任务。');
    }
  }, [applySelection, refreshOverview]);


  const loadArchivedSessions = useCallback(async () => {
    if (!connected) return [];
    setArchivedLoading(true);
    try {
      const next = await window.desktop.listArchivedSessions();
      setArchivedSessions(next);
      return next;
    } catch {
      setError('无法加载已归档任务。');
      return [];
    } finally {
      setArchivedLoading(false);
    }
  }, [connected]);

  const ensureIdleSession = useCallback((): string | undefined => {
    const sessionId = selectedSessionIdRef.current;
    const current = sessions.find((session) => session.id === sessionId);
    if (!sessionId || !current) return undefined;
    if (current.busy) {
      setError('当前任务正在运行，任务运行时不可执行这个操作。');
      return undefined;
    }
    return sessionId;
  }, [sessions]);

  const compactTask = useCallback(async (instruction?: string): Promise<boolean> => {
    const sessionId = ensureIdleSession();
    if (!sessionId) return false;
    try {
      await window.desktop.compactSession({ sessionId, instruction });
      await Promise.all([refreshOverview(), refreshSnapshot(sessionId)]);
      scheduleRuntimeRefresh();
      return true;
    } catch {
      setError('无法压缩当前任务的上下文。');
      return false;
    }
  }, [ensureIdleSession, refreshOverview, refreshSnapshot, scheduleRuntimeRefresh]);

  const undoTask = useCallback(async (): Promise<boolean> => {
    const sessionId = ensureIdleSession();
    if (!sessionId) return false;
    const latestUserEntry = [...(snapshot?.timeline ?? [])].reverse().find((entry) => entry.kind === 'text' && entry.role === 'user');
    const draftText = latestUserEntry?.kind === 'text' ? latestUserEntry.text : undefined;
    if (!draftText) {
      setError('当前任务没有可以撤回的用户请求。');
      return false;
    }
    try {
      await window.desktop.undoSession({ sessionId, count: 1 });
      await Promise.all([refreshOverview(), refreshSnapshot(sessionId)]);
      setComposerDraft((current) => ({ revision: (current?.revision ?? 0) + 1, text: draftText }));
      scheduleRuntimeRefresh();
      return true;
    } catch {
      setError('无法撤回当前任务的上一轮请求。');
      return false;
    }
  }, [ensureIdleSession, refreshOverview, refreshSnapshot, scheduleRuntimeRefresh, snapshot?.timeline]);

  const forkTask = useCallback(async (title?: string): Promise<boolean> => {
    const sessionId = ensureIdleSession();
    if (!sessionId) return false;
    try {
      const next = await window.desktop.forkSession({ sessionId, title });
      const nextSessions = mergeSessions(sessionsRef.current, [next]);
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);
      applySelection(workspaceIdForSession(next, workspacesRef.current) ?? selectedWorkspaceIdRef.current, next.id);
      void refreshOverview();
      return true;
    } catch {
      setError('无法从当前上下文派生新任务。');
      return false;
    }
  }, [applySelection, ensureIdleSession, refreshOverview]);

  const restoreTask = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const restored = await window.desktop.restoreSession({ sessionId });
      setArchivedSessions((current) => current.filter((session) => session.id !== sessionId));
      const nextSessions = mergeSessions(sessionsRef.current, [restored]);
      sessionsRef.current = nextSessions;
      setSessions(nextSessions);
      applySelection(workspaceIdForSession(restored, workspacesRef.current) ?? selectedWorkspaceIdRef.current, restored.id);
      void refreshOverview();
      return true;
    } catch {
      setError('无法恢复这个已归档任务。');
      return false;
    }
  }, [applySelection, refreshOverview]);

  const updateRuntime = useCallback(async (patch: Parameters<typeof updateSessionRuntime>[0]): Promise<boolean> => {
    try {
      await updateSessionRuntime(patch);
      return true;
    } catch {
      setError('无法更新当前任务的运行策略。');
      return false;
    }
  }, [updateSessionRuntime]);

  useEffect(() => {
    if (!connected) {
      snapshotRevision.current += 1;
      void window.desktop.unwatchTask(selectedSessionIdRef.current);
      setWorkspaces([]);
      setSessions([]);
      setModels([]);
      setSelectedModelId(undefined);
      selectedWorkspaceIdRef.current = undefined;
      selectedSessionIdRef.current = undefined;
      setSelectedWorkspaceId(undefined);
      setSelectedSessionId(undefined);
      setSnapshot(undefined);
      setArchivedSessions([]);
      setComposerDraft(undefined);
      return;
    }
    void refreshOverview();
  }, [connected, refreshOverview]);

  useEffect(() => {
    if (!connected || !selectedSessionId) return;
    setLoading(true);
    void refreshSnapshot(selectedSessionId).finally(() => {
      if (selectedSessionIdRef.current === selectedSessionId) setLoading(false);
    });
  }, [connected, refreshSnapshot, selectedSessionId]);

  useEffect(() => {
    if (!connected) return;
    return window.desktop.onTaskEvent((event) => {
      if (event.sessionId === selectedSessionIdRef.current) {
        void refreshSnapshot(event.sessionId);
        scheduleRuntimeRefresh();
      }
      if (overviewTimer.current !== undefined) window.clearTimeout(overviewTimer.current);
      overviewTimer.current = window.setTimeout(() => { void refreshOverview(); }, 120);
    });
  }, [connected, refreshOverview, refreshSnapshot, scheduleRuntimeRefresh]);

  useEffect(() => () => {
    if (overviewTimer.current !== undefined) window.clearTimeout(overviewTimer.current);
    void window.desktop.unwatchTask(selectedSessionIdRef.current);
  }, []);

  const visibleSessions = useMemo(() => {
    if (!selectedWorkspaceId) return sessions;
    const workspace = workspaces.find((item) => item.id === selectedWorkspaceId);
    return sessions.filter((session) => session.workspaceId === selectedWorkspaceId || (session.workspaceId === undefined && session.cwd === workspace?.root));
  }, [selectedWorkspaceId, sessions, workspaces]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const configuredModelId = selectedModelId ?? snapshot?.status.model ?? selectedSession?.model;
  const activeModelId = models.some((model) => model.id === configuredModelId) ? configuredModelId : undefined;
  return {
    workspaces,
    models,
    activeModelId,
    sessions,
    visibleSessions,
    workspacePages,
    selectedWorkspaceId,
    selectedSession,
    selectedSessionId,
    snapshot,
    runtime,
    runtimeLoading,
    runtimeUpdating,
    archivedSessions,
    archivedLoading,
    composerDraft,
    loading,
    error: error ?? runtimeError,
    pendingApprovalIds,
    actions: {
      refreshOverview,
      selectWorkspace,
      selectTask,
      chooseWorkspaceFolder,
      createWorkspace,
      createWorkspaceFolder,
      renameWorkspace,
      removeWorkspace,
      loadMoreWorkspaceSessions,
      createTask,
      selectModel: setSelectedModelId,
      sendPrompt,
      abort,
      respondApproval,
      respondQuestion,
      dismissQuestion,
      renameTask,
      archiveTask,
      loadArchivedSessions,
      compactTask,
      undoTask,
      forkTask,
      restoreTask,
      refreshRuntime,
      updateRuntime,
      clearComposerDraft: () => setComposerDraft(undefined),
      clearError: () => setError(undefined),
    },
  };
}

