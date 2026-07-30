import {
  CompactSessionRequestSchema,
  CopyTextRequestSchema,
  ForkSessionRequestSchema,
  RestoreSessionRequestSchema,
  RevealPathRequestSchema,
  SessionIdSchema,
  UndoSessionRequestSchema,
  UpdateRuntimeRequestSchema,
  type CliDiscovery,
  type CompactSessionRequest,
  type DesktopCapabilitySnapshot,
  type DesktopSession,
  type DesktopSessionRuntime,
  type DesktopStatus,
  type DesktopTaskEvent,
  type ForkSessionRequest,
  type RestoreSessionRequest,
  type ServerStatus,
  type UndoSessionRequest,
  type UpdateRuntimeRequest,
} from '../shared/contracts';

export interface ServerLifecyclePort {
  snapshot(): ServerStatus;
  start(cli: Extract<CliDiscovery, { kind: 'ready' }>): Promise<void>;
  stop(): void;
  onStatus(listener: (status: ServerStatus) => void): () => void;
}

export interface LiveTaskFeedPort {
  watch(sessionId: string, agentId: string): void;
  unwatch(sessionId?: string): void;
  onRefresh(listener: (event: DesktopTaskEvent) => void): () => void;
}


export interface CapabilityServicePort {
  snapshot(): DesktopCapabilitySnapshot;
  refresh(cliVersion: string, force?: boolean): Promise<DesktopCapabilitySnapshot>;
  reset(cliVersion?: string): DesktopCapabilitySnapshot;
  onSnapshot(listener: (snapshot: DesktopCapabilitySnapshot) => void): () => void;
}

export interface DesktopControllerOptions {
  readonly discover: () => Promise<CliDiscovery>;
  readonly validate: (command: string) => Promise<CliDiscovery>;
  readonly lifecycle: ServerLifecyclePort;
  readonly feed: LiveTaskFeedPort;
  readonly capabilities: CapabilityServicePort;
}

export class DesktopController {
  #cli: CliDiscovery = { kind: 'checking' };
  #listeners = new Set<(status: DesktopStatus) => void>();
  #taskListeners = new Set<(event: DesktopTaskEvent) => void>();

  constructor(private readonly options: DesktopControllerOptions) {
    this.options.lifecycle.onStatus((status) => {
      if (status.kind !== 'connected') this.options.feed.unwatch();
      this.#syncCapabilities(status);
      this.#emit();
    });
    this.options.feed.onRefresh((event) => {
      for (const listener of this.#taskListeners) listener(event);
    });
  }

  status(): DesktopStatus {
    return { cli: this.#cli, server: this.options.lifecycle.snapshot() };
  }

  onStatus(listener: (status: DesktopStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  capabilitySnapshot(): DesktopCapabilitySnapshot {
    return this.options.capabilities.snapshot();
  }

  onCapabilities(listener: (snapshot: DesktopCapabilitySnapshot) => void): () => void {
    return this.options.capabilities.onSnapshot(listener);
  }

  async refreshCapabilities(): Promise<DesktopCapabilitySnapshot> {
    if (this.#cli.kind !== 'ready' || this.options.lifecycle.snapshot().kind !== 'connected') {
      return this.options.capabilities.reset(this.#cli.kind === 'ready' ? this.#cli.version : undefined);
    }
    return this.options.capabilities.refresh(this.#cli.version, true);
  }

  async refreshCli(): Promise<DesktopStatus> {
    this.#cli = { kind: 'checking' };
    this.#emit();
    this.#cli = await this.options.discover();
    this.#syncCapabilities(this.options.lifecycle.snapshot());
    this.#emit();
    return this.status();
  }

  async chooseCliExecutable(command: string): Promise<DesktopStatus> {
    this.#cli = await this.options.validate(command);
    this.#syncCapabilities(this.options.lifecycle.snapshot());
    this.#emit();
    return this.status();
  }

  async startServer(): Promise<DesktopStatus> {
    if (this.#cli.kind !== 'ready') throw new Error('Kimi Code CLI is not ready');
    await this.options.lifecycle.start(this.#cli);
    return this.status();
  }

  stopServer(): DesktopStatus {
    this.options.lifecycle.stop();
    return this.status();
  }

  async watchTask(sessionId: string, agentId: string): Promise<void> {
    if (this.options.lifecycle.snapshot().kind !== 'connected') {
      throw new Error('Kimi Code local service is not connected.');
    }
    this.options.feed.watch(sessionId, agentId);
  }

  unwatchTask(sessionId?: string): void {
    this.options.feed.unwatch(sessionId);
  }

  onTaskEvent(listener: (event: DesktopTaskEvent) => void): () => void {
    this.#taskListeners.add(listener);
    return () => this.#taskListeners.delete(listener);
  }

  #syncCapabilities(status: ServerStatus): void {
    if (status.kind === 'connected' && this.#cli.kind === 'ready') {
      void this.options.capabilities.refresh(this.#cli.version).catch(() => undefined);
      return;
    }
    this.options.capabilities.reset(this.#cli.kind === 'ready' ? this.#cli.version : undefined);
  }

  #emit(): void {
    const status = this.status();
    for (const listener of this.#listeners) listener(status);
  }
}


export interface SessionIpcClientPort {
  listArchivedSessions(): Promise<DesktopSession[]>;
  getSessionRuntime(sessionId: string): Promise<DesktopSessionRuntime>;
  updateSessionRuntime(input: UpdateRuntimeRequest): Promise<DesktopSessionRuntime>;
  compactSession(input: CompactSessionRequest): Promise<void>;
  undoSession(input: UndoSessionRequest): Promise<void>;
  forkSession(input: ForkSessionRequest): Promise<DesktopSession>;
  restoreSession(input: RestoreSessionRequest): Promise<DesktopSession>;
}

export function createSessionIpcHandlers(client: SessionIpcClientPort) {
  return {
    listArchived: async () => client.listArchivedSessions(),
    getRuntime: async (sessionId: unknown) => client.getSessionRuntime(SessionIdSchema.parse(sessionId)),
    updateRuntime: async (input: unknown) => client.updateSessionRuntime(UpdateRuntimeRequestSchema.parse(input)),
    compact: async (input: unknown) => client.compactSession(CompactSessionRequestSchema.parse(input)),
    undo: async (input: unknown) => client.undoSession(UndoSessionRequestSchema.parse(input)),
    fork: async (input: unknown) => client.forkSession(ForkSessionRequestSchema.parse(input)),
    restore: async (input: unknown) => client.restoreSession(RestoreSessionRequestSchema.parse(input)),
  };
}
export interface ReviewActionsPort {
  exists(path: string): boolean;
  reveal(path: string): void;
  copy(text: string): void;
}

export function createReviewIpcHandlers(actions: ReviewActionsPort) {
  return {
    reveal: async (input: unknown): Promise<void> => {
      const request = RevealPathRequestSchema.parse(input);
      if (!actions.exists(request.path)) throw new Error('路径不存在，无法在资源管理器中显示。');
      actions.reveal(request.path);
    },
    copy: async (input: unknown): Promise<void> => {
      const request = CopyTextRequestSchema.parse(input);
      actions.copy(request.text);
    },
  };
}
