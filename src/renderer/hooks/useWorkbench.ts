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

export function useWorkbench(connected: boolean) {
  const [workspaces, setWorkspaces] = useState<DesktopWorkspace[]>([]);
  const [sessions, setSessions] = useState<DesktopSession[]>([]);
  const [models, setModels] = useState<DesktopModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [snapshot, setSnapshot] = useState<DesktopTaskSnapshot>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const selectedSessionIdRef = useRef(selectedSessionId);
  const snapshotRevision = useRef(0);
  selectedSessionIdRef.current = selectedSessionId;

  const refreshOverview = useCallback(async () => {
    if (!connected) return;
    try {
      const [nextWorkspaces, nextSessions, nextModels] = await Promise.all([
        window.desktop.listWorkspaces(),
        window.desktop.listSessions(),
        window.desktop.listModels().catch(() => []),
      ]);
      setWorkspaces(nextWorkspaces);
      setSessions(nextSessions);
      setModels(nextModels);
      setSelectedWorkspaceId((current) => current && nextWorkspaces.some((workspace) => workspace.id === current)
        ? current
        : nextWorkspaces[0]?.id);
      setSelectedSessionId((current) => current && nextSessions.some((session) => session.id === current)
        ? current
        : nextSessions[0]?.id);
      setError(undefined);
    } catch {
      setError('无法加载本地服务中的工作区和任务。');
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

  const selectTask = useCallback((sessionId: string) => {
    if (sessionId === selectedSessionIdRef.current) return;
    const previous = selectedSessionIdRef.current;
    selectedSessionIdRef.current = sessionId;
    setSelectedSessionId(sessionId);
    setSnapshot(undefined);
    setSelectedModelId(undefined);
    if (previous) void window.desktop.unwatchTask(previous);
  }, []);

  const selectWorkspace = useCallback((workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    const workspace = workspaces.find((item) => item.id === workspaceId);
    const nextSession = sessions.find((session) =>
      session.workspaceId === workspaceId || (session.workspaceId === undefined && session.cwd === workspace?.root));

    if (nextSession) {
      selectTask(nextSession.id);
      return;
    }

    const previous = selectedSessionIdRef.current;
    snapshotRevision.current += 1;
    selectedSessionIdRef.current = undefined;
    setSelectedSessionId(undefined);
    setSelectedModelId(undefined);
    setSnapshot(undefined);
    if (previous) void window.desktop.unwatchTask(previous);
  }, [selectTask, sessions, workspaces]);

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
      await refreshOverview();
      setSelectedWorkspaceId(workspace.id);
      return workspace;
    } catch {
      setError('无法添加这个工作区文件夹。');
      return undefined;
    }
  }, [refreshOverview]);

  const createTask = useCallback(async (input?: CreateTaskRequest) => {
    try {
      const next = await window.desktop.createTask(input);
      if (!next) return undefined;
      await refreshOverview();
      selectTask(next.id);
      return next;
    } catch {
      setError('无法创建任务，请检查本地服务和工作区路径。');
      return undefined;
    }
  }, [refreshOverview, selectTask]);

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

  const respondApproval = useCallback(async (input: ApprovalDecisionRequest) => {
    try {
      await window.desktop.respondApproval(input);
      await Promise.all([refreshOverview(), refreshSnapshot(input.sessionId)]);
    } catch {
      setError('无法提交审批决定。');
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
      if (selectedSessionIdRef.current === sessionId) {
        selectedSessionIdRef.current = undefined;
        setSelectedSessionId(undefined);
        setSnapshot(undefined);
        void window.desktop.unwatchTask(sessionId);
      }
      await refreshOverview();
    } catch {
      setError('无法归档这个任务。');
    }
  }, [refreshOverview]);

  useEffect(() => {
    if (!connected) {
      snapshotRevision.current += 1;
      void window.desktop.unwatchTask(selectedSessionIdRef.current);
      setWorkspaces([]);
      setSessions([]);
      setModels([]);
      setSelectedModelId(undefined);
      setSelectedWorkspaceId(undefined);
      setSelectedSessionId(undefined);
      setSnapshot(undefined);
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
      if (event.sessionId === selectedSessionIdRef.current) void refreshSnapshot(event.sessionId);
      void refreshOverview();
    });
  }, [connected, refreshOverview, refreshSnapshot]);

  useEffect(() => () => {
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
    sessions: visibleSessions,
    selectedWorkspaceId,
    selectedSession,
    selectedSessionId,
    snapshot,
    loading,
    error,
    actions: {
      refreshOverview,
      selectWorkspace,
      selectTask,
      chooseWorkspaceFolder,
      createWorkspace,
      createTask,
      selectModel: setSelectedModelId,
      sendPrompt,
      abort,
      respondApproval,
      respondQuestion,
      dismissQuestion,
      renameTask,
      archiveTask,
      clearError: () => setError(undefined),
    },
  };
}
