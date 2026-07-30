import type { CliDiscovery, DesktopStatus, DesktopTaskEvent, ServerStatus } from '../shared/contracts';

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

export interface DesktopControllerOptions {
  readonly discover: () => Promise<CliDiscovery>;
  readonly validate: (command: string) => Promise<CliDiscovery>;
  readonly lifecycle: ServerLifecyclePort;
  readonly feed: LiveTaskFeedPort;
}

export class DesktopController {
  #cli: CliDiscovery = { kind: 'checking' };
  #listeners = new Set<(status: DesktopStatus) => void>();
  #taskListeners = new Set<(event: DesktopTaskEvent) => void>();

  constructor(private readonly options: DesktopControllerOptions) {
    this.options.lifecycle.onStatus((status) => {
      if (status.kind !== 'connected') this.options.feed.unwatch();
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

  async refreshCli(): Promise<DesktopStatus> {
    this.#cli = { kind: 'checking' };
    this.#emit();
    this.#cli = await this.options.discover();
    this.#emit();
    return this.status();
  }

  async chooseCliExecutable(command: string): Promise<DesktopStatus> {
    this.#cli = await this.options.validate(command);
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

  #emit(): void {
    const status = this.status();
    for (const listener of this.#listeners) listener(status);
  }
}
