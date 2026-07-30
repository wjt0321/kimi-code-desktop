import type {
  ApprovalDecisionRequest,
  CompactSessionRequest,
  CreateTaskRequest,
  DesktopMessage,
  DesktopModel,
  DesktopSession,
  DesktopSessionRuntime,
  DesktopStatus,
  DesktopTaskEvent,
  DesktopTaskSnapshot,
  DesktopWorkspace,
  ForkSessionRequest,
  PromptRequest,
  QuestionDismissRequest,
  QuestionResponseRequest,
  RenameSessionRequest,
  RestoreSessionRequest,
  TaskWatchRequest,
  UndoSessionRequest,
  UpdateRuntimeRequest,
  WorkspaceRootRequest,
} from '../shared/contracts';

export interface DesktopApi {
  status(): Promise<DesktopStatus>;
  refreshCli(): Promise<DesktopStatus>;
  chooseCliExecutable(): Promise<DesktopStatus>;
  startServer(): Promise<DesktopStatus>;
  stopServer(): Promise<DesktopStatus>;
  confirmClose(): void;
  onCloseRequested(listener: () => void): () => void;
  listWorkspaces(): Promise<DesktopWorkspace[]>;
  chooseWorkspaceFolder(): Promise<string | null>;
  createWorkspace(input: WorkspaceRootRequest): Promise<DesktopWorkspace>;
  listSessions(): Promise<DesktopSession[]>;
  listArchivedSessions(): Promise<DesktopSession[]>;
  getSessionRuntime(sessionId: string): Promise<DesktopSessionRuntime>;
  updateSessionRuntime(input: UpdateRuntimeRequest): Promise<DesktopSessionRuntime>;
  compactSession(input: CompactSessionRequest): Promise<void>;
  undoSession(input: UndoSessionRequest): Promise<void>;
  forkSession(input: ForkSessionRequest): Promise<DesktopSession>;
  restoreSession(input: RestoreSessionRequest): Promise<DesktopSession>;
  listModels(): Promise<DesktopModel[]>;
  renameSession(input: RenameSessionRequest): Promise<void>;
  archiveSession(sessionId: string): Promise<void>;
  getTaskSnapshot(sessionId: string): Promise<DesktopTaskSnapshot>;
  watchTask(input: TaskWatchRequest): Promise<void>;
  unwatchTask(sessionId?: string): Promise<void>;
  createTask(input?: CreateTaskRequest): Promise<DesktopSession | null>;
  listMessages(sessionId: string): Promise<DesktopMessage[]>;
  submitPrompt(input: PromptRequest): Promise<void>;
  abortSession(sessionId: string): Promise<void>;
  respondApproval(input: ApprovalDecisionRequest): Promise<void>;
  respondQuestion(input: QuestionResponseRequest): Promise<void>;
  dismissQuestion(input: QuestionDismissRequest): Promise<void>;
  onStatus(listener: (status: DesktopStatus) => void): () => void;
  onTaskEvent(listener: (event: DesktopTaskEvent) => void): () => void;
}

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

export {};
