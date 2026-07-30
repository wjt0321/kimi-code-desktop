import { contextBridge, ipcRenderer } from 'electron';
import { z } from 'zod';

import {
  ApprovalDecisionRequestSchema,
  CompactSessionRequestSchema,
  CreateTaskRequestSchema,
  DesktopMessageSchema,
  DesktopModelSchema,
  DesktopSessionRuntimeSchema,
  DesktopSessionSchema,
  DesktopStatusSchema,
  DesktopTaskEventSchema,
  DesktopTaskSnapshotSchema,
  DesktopWorkspaceSchema,
  ForkSessionRequestSchema,
  PromptRequestSchema,
  QuestionDismissRequestSchema,
  QuestionResponseRequestSchema,
  RenameSessionRequestSchema,
  RestoreSessionRequestSchema,
  SessionIdSchema,
  TaskWatchRequestSchema,
  UndoSessionRequestSchema,
  UpdateRuntimeRequestSchema,
  WorkspaceRootRequestSchema,
  type DesktopMessage,
  type DesktopModel,
  type CompactSessionRequest,
  type DesktopSession,
  type DesktopSessionRuntime,
  type DesktopStatus,
  type DesktopTaskEvent,
  type DesktopTaskSnapshot,
  type DesktopWorkspace,
  type ForkSessionRequest,
  type PromptRequest,
  type RenameSessionRequest,
  type RestoreSessionRequest,
  type UndoSessionRequest,
  type UpdateRuntimeRequest,
} from '../shared/contracts';

function parseStatus(value: unknown): DesktopStatus {
  return DesktopStatusSchema.parse(value);
}

function parseSession(value: unknown): DesktopSession {
  return DesktopSessionSchema.parse(value);
}

function parseSessionRuntime(value: unknown): DesktopSessionRuntime {
  return DesktopSessionRuntimeSchema.parse(value);
}

function parseMessages(value: unknown): DesktopMessage[] {
  return DesktopMessageSchema.array().parse(value);
}

function parseModels(value: unknown): DesktopModel[] {
  return DesktopModelSchema.array().parse(value);
}

function parseSessions(value: unknown): DesktopSession[] {
  return DesktopSessionSchema.array().parse(value);
}

function parseWorkspace(value: unknown): DesktopWorkspace {
  return DesktopWorkspaceSchema.parse(value);
}

function parseWorkspaces(value: unknown): DesktopWorkspace[] {
  return DesktopWorkspaceSchema.array().parse(value);
}

function parseTaskSnapshot(value: unknown): DesktopTaskSnapshot {
  return DesktopTaskSnapshotSchema.parse(value);
}

function parseFolder(value: unknown): string | null {
  return value === null ? null : z.string().min(1).parse(value);
}

function subscribe(listener: (status: DesktopStatus) => void): () => void {
  const eventName = 'desktop:status-changed';
  const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(parseStatus(value));
  ipcRenderer.on(eventName, handler);
  return () => ipcRenderer.removeListener(eventName, handler);
}

function subscribeTask(listener: (event: DesktopTaskEvent) => void): () => void {
  const eventName = 'desktop:task-event';
  const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(DesktopTaskEventSchema.parse(value));
  ipcRenderer.on(eventName, handler);
  return () => ipcRenderer.removeListener(eventName, handler);
}

function subscribeCloseRequested(listener: () => void): () => void {
  const eventName = 'desktop:close-requested';
  const handler = () => listener();
  ipcRenderer.on(eventName, handler);
  return () => ipcRenderer.removeListener(eventName, handler);
}

contextBridge.exposeInMainWorld('desktop', {
  status: () => ipcRenderer.invoke('desktop:status').then(parseStatus),
  refreshCli: () => ipcRenderer.invoke('desktop:refresh-cli').then(parseStatus),
  chooseCliExecutable: () => ipcRenderer.invoke('desktop:choose-cli-executable').then(parseStatus),
  startServer: () => ipcRenderer.invoke('desktop:start-server').then(parseStatus),
  stopServer: () => ipcRenderer.invoke('desktop:stop-server').then(parseStatus),
  confirmClose: () => ipcRenderer.send('desktop:confirm-close'),
  onCloseRequested: subscribeCloseRequested,
  listWorkspaces: () => ipcRenderer.invoke('desktop:list-workspaces').then(parseWorkspaces),
  chooseWorkspaceFolder: () => ipcRenderer.invoke('desktop:choose-workspace-folder').then(parseFolder),
  createWorkspace: (input: { root: string }) => ipcRenderer.invoke('desktop:create-workspace', WorkspaceRootRequestSchema.parse(input)).then(parseWorkspace),
  listSessions: () => ipcRenderer.invoke('desktop:list-sessions').then(parseSessions),
  listArchivedSessions: () => ipcRenderer.invoke('desktop:list-archived-sessions').then(parseSessions),
  getSessionRuntime: (sessionId: string) => ipcRenderer.invoke('desktop:get-session-runtime', SessionIdSchema.parse(sessionId)).then(parseSessionRuntime),
  updateSessionRuntime: (input: UpdateRuntimeRequest) => ipcRenderer.invoke('desktop:update-session-runtime', UpdateRuntimeRequestSchema.parse(input)).then(parseSessionRuntime),
  compactSession: (input: CompactSessionRequest) => ipcRenderer.invoke('desktop:compact-session', CompactSessionRequestSchema.parse(input)),
  undoSession: (input: UndoSessionRequest) => ipcRenderer.invoke('desktop:undo-session', UndoSessionRequestSchema.parse(input)),
  forkSession: (input: ForkSessionRequest) => ipcRenderer.invoke('desktop:fork-session', ForkSessionRequestSchema.parse(input)).then(parseSession),
  restoreSession: (input: RestoreSessionRequest) => ipcRenderer.invoke('desktop:restore-session', RestoreSessionRequestSchema.parse(input)).then(parseSession),
  listModels: () => ipcRenderer.invoke('desktop:list-models').then(parseModels),
  renameSession: (input: RenameSessionRequest) => ipcRenderer.invoke('desktop:rename-session', RenameSessionRequestSchema.parse(input)),
  archiveSession: (sessionId: string) => ipcRenderer.invoke('desktop:archive-session', SessionIdSchema.parse(sessionId)),
  getTaskSnapshot: (sessionId: string) => ipcRenderer.invoke('desktop:get-task-snapshot', SessionIdSchema.parse(sessionId)).then(parseTaskSnapshot),
  watchTask: (input: { sessionId: string; agentId: string }) => ipcRenderer.invoke('desktop:watch-task', TaskWatchRequestSchema.parse(input)),
  unwatchTask: (sessionId?: string) => ipcRenderer.invoke('desktop:unwatch-task', sessionId === undefined ? undefined : SessionIdSchema.parse(sessionId)),
  createTask: (input?: { target: 'workspace'; workspaceId: string; title?: string } | { target: 'folder'; cwd: string; title?: string }) => input === undefined
    ? ipcRenderer.invoke('desktop:create-task').then((value: unknown) => value === null ? null : parseSession(value))
    : ipcRenderer.invoke('desktop:create-task', CreateTaskRequestSchema.parse(input)).then(parseSession),
  listMessages: (sessionId: string) => ipcRenderer.invoke('desktop:list-messages', sessionId).then(parseMessages),
  submitPrompt: (input: PromptRequest) => ipcRenderer.invoke('desktop:submit-prompt', PromptRequestSchema.parse(input)),
  abortSession: (sessionId: string) => ipcRenderer.invoke('desktop:abort-session', SessionIdSchema.parse(sessionId)),
  respondApproval: (input: unknown) => ipcRenderer.invoke('desktop:respond-approval', ApprovalDecisionRequestSchema.parse(input)),
  respondQuestion: (input: unknown) => ipcRenderer.invoke('desktop:respond-question', QuestionResponseRequestSchema.parse(input)),
  dismissQuestion: (input: unknown) => ipcRenderer.invoke('desktop:dismiss-question', QuestionDismissRequestSchema.parse(input)),
  onStatus: subscribe,
  onTaskEvent: subscribeTask,
});
