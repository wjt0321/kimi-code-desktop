import type {
  ApprovalDecisionRequest,
  CreateTaskRequest,
  DesktopMessage,
  DesktopModel,
  DesktopSession,
  DesktopStatus,
  DesktopTaskEvent,
  DesktopTaskSnapshot,
  DesktopWorkspace,
  PromptRequest,
  QuestionDismissRequest,
  QuestionResponseRequest,
  RenameSessionRequest,
  TaskWatchRequest,
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
