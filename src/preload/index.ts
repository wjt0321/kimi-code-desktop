import { contextBridge, ipcRenderer } from 'electron';
import { z } from 'zod';

import { applyBootstrapTheme } from './bootstrap-theme';

import {
  ApprovalDecisionRequestSchema,
  CompactSessionRequestSchema,
  CheckCliUpdateRequestSchema,
  CopyTextRequestSchema,
  CreateWorkspaceFolderRequestSchema,
  CreateTaskRequestSchema,
  DesktopCapabilitySnapshotSchema,
  DesktopCliUpdateSnapshotSchema,
  DesktopMessageSchema,
  DesktopModelSchema,
  DesktopSessionPageSchema,
  DesktopSessionRuntimeSchema,
  DesktopSessionSchema,
  DesktopStatusSchema,
  DesktopTaskEventSchema,
  DesktopTaskSnapshotSchema,
  DesktopThemeSnapshotSchema,
  SetThemeRequestSchema,
  DesktopWorkspaceSchema,
  ForkSessionRequestSchema,
  ListSessionsRequestSchema,
  PromptRequestSchema,
  QuestionDismissRequestSchema,
  QuestionResponseRequestSchema,
  RemoveWorkspaceRequestSchema,
  RenameSessionRequestSchema,
  RenameWorkspaceRequestSchema,
  RestoreSessionRequestSchema,
  RevealPathRequestSchema,
  SessionIdSchema,
  TaskWatchRequestSchema,
  UndoSessionRequestSchema,
  UpdateRuntimeRequestSchema,
  WorkspaceRootRequestSchema,
  type DesktopCapabilitySnapshot,
  type DesktopCliUpdateSnapshot,
  type DesktopMessage,
  type DesktopModel,
  type CompactSessionRequest,
  type CopyTextRequest,
  type DesktopSession,
  type DesktopSessionPage,
  type DesktopSessionRuntime,
  type DesktopStatus,
  type DesktopTaskEvent,
  type DesktopTaskSnapshot,
  type DesktopThemeSnapshot,
  type DesktopWorkspace,
  type ForkSessionRequest,
  type ListSessionsRequest,
  type PromptRequest,
  type RemoveWorkspaceRequest,
  type RenameSessionRequest,
  type RenameWorkspaceRequest,
  type RestoreSessionRequest,
  type RevealPathRequest,
  type UndoSessionRequest,
  type UpdateRuntimeRequest,
} from '../shared/contracts';

if (!applyBootstrapTheme(document.documentElement, process.argv)) {
  window.addEventListener('DOMContentLoaded', () => {
    applyBootstrapTheme(document.documentElement, process.argv);
  }, { once: true });
}

function parseStatus(value: unknown): DesktopStatus {
  return DesktopStatusSchema.parse(value);
}

function parseTheme(value: unknown): DesktopThemeSnapshot {
  return DesktopThemeSnapshotSchema.parse(value);
}

function parseCliUpdate(value: unknown): DesktopCliUpdateSnapshot {
  return DesktopCliUpdateSnapshotSchema.parse(value);
}

function parseCapabilities(value: unknown): DesktopCapabilitySnapshot {
  return DesktopCapabilitySnapshotSchema.parse(value);
}

function parseSession(value: unknown): DesktopSession {
  return DesktopSessionSchema.parse(value);
}

function parseSessionPage(value: unknown): DesktopSessionPage {
  return DesktopSessionPageSchema.parse(value);
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

function subscribeTheme(listener: (snapshot: DesktopThemeSnapshot) => void): () => void {
  const eventName = 'desktop:theme-changed';
  const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(parseTheme(value));
  ipcRenderer.on(eventName, handler);
  return () => ipcRenderer.removeListener(eventName, handler);
}

function subscribeCliUpdate(listener: (snapshot: DesktopCliUpdateSnapshot) => void): () => void {
  const eventName = 'desktop:cli-update-changed';
  const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(parseCliUpdate(value));
  ipcRenderer.on(eventName, handler);
  return () => ipcRenderer.removeListener(eventName, handler);
}

function subscribeCapabilities(listener: (snapshot: DesktopCapabilitySnapshot) => void): () => void {
  const eventName = 'desktop:capabilities-changed';
  const handler = (_event: Electron.IpcRendererEvent, value: unknown) => listener(parseCapabilities(value));
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
  theme: () => ipcRenderer.invoke('desktop:theme').then(parseTheme),
  setTheme: (input: unknown) => ipcRenderer.invoke('desktop:set-theme', SetThemeRequestSchema.parse(input)).then(parseTheme),
  onTheme: subscribeTheme,
  cliUpdate: () => ipcRenderer.invoke('desktop:cli-update').then(parseCliUpdate),
  checkCliUpdate: (force = true) => ipcRenderer.invoke('desktop:check-cli-update', CheckCliUpdateRequestSchema.parse({ force })).then(parseCliUpdate),
  installCliUpdate: () => ipcRenderer.invoke('desktop:install-cli-update').then(parseCliUpdate),
  onCliUpdate: subscribeCliUpdate,
  capabilities: () => ipcRenderer.invoke('desktop:capabilities').then(parseCapabilities),
  refreshCapabilities: () => ipcRenderer.invoke('desktop:refresh-capabilities').then(parseCapabilities),
  refreshCli: () => ipcRenderer.invoke('desktop:refresh-cli').then(parseStatus),
  chooseCliExecutable: () => ipcRenderer.invoke('desktop:choose-cli-executable').then(parseStatus),
  startServer: () => ipcRenderer.invoke('desktop:start-server').then(parseStatus),
  stopServer: () => ipcRenderer.invoke('desktop:stop-server').then(parseStatus),
  confirmClose: () => ipcRenderer.send('desktop:confirm-close'),
  onCloseRequested: subscribeCloseRequested,
  listWorkspaces: () => ipcRenderer.invoke('desktop:list-workspaces').then(parseWorkspaces),
  chooseWorkspaceFolder: () => ipcRenderer.invoke('desktop:choose-workspace-folder').then(parseFolder),
  createWorkspace: (input: { root: string }) => ipcRenderer.invoke('desktop:create-workspace', WorkspaceRootRequestSchema.parse(input)).then(parseWorkspace),
  createWorkspaceFolder: (input: { name: string }) => ipcRenderer.invoke('desktop:create-workspace-folder', CreateWorkspaceFolderRequestSchema.parse(input)).then((value: unknown) => value === null ? null : parseWorkspace(value)),
  renameWorkspace: (input: RenameWorkspaceRequest) => ipcRenderer.invoke('desktop:rename-workspace', RenameWorkspaceRequestSchema.parse(input)).then(parseWorkspace),
  removeWorkspace: (input: RemoveWorkspaceRequest) => ipcRenderer.invoke('desktop:remove-workspace', RemoveWorkspaceRequestSchema.parse(input)),
  listSessionPage: (input: ListSessionsRequest) => ipcRenderer.invoke('desktop:list-session-page', ListSessionsRequestSchema.parse(input)).then(parseSessionPage),
  listSessions: () => ipcRenderer.invoke('desktop:list-sessions').then(parseSessions),
  listArchivedSessions: () => ipcRenderer.invoke('desktop:list-archived-sessions').then(parseSessions),
  getSessionRuntime: (sessionId: string) => ipcRenderer.invoke('desktop:get-session-runtime', SessionIdSchema.parse(sessionId)).then(parseSessionRuntime),
  updateSessionRuntime: (input: UpdateRuntimeRequest) => ipcRenderer.invoke('desktop:update-session-runtime', UpdateRuntimeRequestSchema.parse(input)).then(parseSessionRuntime),
  compactSession: (input: CompactSessionRequest) => ipcRenderer.invoke('desktop:compact-session', CompactSessionRequestSchema.parse(input)),
  undoSession: (input: UndoSessionRequest) => ipcRenderer.invoke('desktop:undo-session', UndoSessionRequestSchema.parse(input)),
  forkSession: (input: ForkSessionRequest) => ipcRenderer.invoke('desktop:fork-session', ForkSessionRequestSchema.parse(input)).then(parseSession),
  restoreSession: (input: RestoreSessionRequest) => ipcRenderer.invoke('desktop:restore-session', RestoreSessionRequestSchema.parse(input)).then(parseSession),
  revealPath: (input: RevealPathRequest) => ipcRenderer.invoke('desktop:reveal-path', RevealPathRequestSchema.parse(input)),
  copyText: (input: CopyTextRequest) => ipcRenderer.invoke('desktop:copy-text', CopyTextRequestSchema.parse(input)),
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
  onCapabilities: subscribeCapabilities,
  onTaskEvent: subscribeTask,
});
