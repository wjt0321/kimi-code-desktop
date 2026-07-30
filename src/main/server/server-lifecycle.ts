import { EventEmitter } from 'node:events';

import type { CliDiscovery, ServerStatus } from '../../shared/contracts';
import type { LiveTaskSocket } from './live-task-feed';
import { parseStartupAccess, redactStartupLine } from './startup-output';

export interface ManagedChild {
  readonly stdout: EventEmitter;
  readonly stderr: EventEmitter;
  once(event: 'error', listener: (error: Error) => void): void;
  once(event: 'exit', listener: (code: number | null) => void): void;
  kill(): boolean;
}

export interface ChildProcessFactory {
  spawn(command: string, args: readonly string[]): ManagedChild;
}

export interface KimiServerLifecycleOptions {
  readonly childFactory: ChildProcessFactory;
  readonly portProvider: () => Promise<number>;
  readonly startupTimeoutMs?: number;
}

export class KimiServerLifecycle {
  #child: ManagedChild | undefined;
  #token: string | undefined;
  #status: ServerStatus = { kind: 'idle' };
  #diagnostic = '';
  #outputBuffer = '';
  #timeout: NodeJS.Timeout | undefined;
  #listeners = new Set<(status: ServerStatus) => void>();

  constructor(private readonly options: KimiServerLifecycleOptions) {}

  snapshot(): ServerStatus {
    return this.#status;
  }

  lastDiagnostic(): string {
    return this.#diagnostic;
  }

  openEventSocket(): LiveTaskSocket {
    if (this.#status.kind !== 'connected' || !this.#token) {
      throw new Error('Kimi Code local service is not connected.');
    }
    if (typeof WebSocket !== 'function') {
      throw new Error('当前桌面运行时不支持本地服务实时连接。');
    }
    const socketUrl = new URL('/api/v1/ws', this.#status.origin);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    return new WebSocket(socketUrl.toString(), [`kimi-code.bearer.${this.#token}`]);
  }

  async request(path: string, init: RequestInit = {}): Promise<unknown> {
    if (this.#status.kind !== 'connected' || !this.#token) {
      throw new Error('Kimi Code local service is not connected.');
    }

    const response = await fetch(new URL(`/api/v1${path}`, this.#status.origin), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.#token}`,
        ...init.headers,
      },
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Kimi Code local service returned an invalid response.');
    }

    if (!response.ok || !isSuccessEnvelope(body)) {
      throw new Error('Kimi Code local service request failed.');
    }
    return body.data;
  }

  onStatus(listener: (status: ServerStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async start(cli: Extract<CliDiscovery, { kind: 'ready' }>): Promise<void> {
    if (this.#child) return;

    const port = await this.options.portProvider();
    const child = this.options.childFactory.spawn(cli.command, ['web', '--no-open', '--port', String(port)]);
    this.#child = child;
    this.#token = undefined;
    this.#diagnostic = '';
    this.#outputBuffer = '';
    this.#setStatus({ kind: 'starting', command: cli.command });

    child.stdout.on('data', (chunk: Buffer | string) => this.#handleOutput(String(chunk)));
    child.stderr.on('data', (chunk: Buffer | string) => this.#handleOutput(String(chunk)));
    child.once('error', () => this.#fail('Kimi Code local service could not start.'));
    child.once('exit', (code) => {
      if (this.#child !== child || this.#status.kind === 'idle') return;
      this.#fail(code === 0 ? 'Kimi Code local service stopped unexpectedly.' : 'Kimi Code local service exited unexpectedly.');
    });

    const timeout = this.options.startupTimeoutMs ?? 15_000;
    this.#timeout = setTimeout(() => {
      if (this.#status.kind === 'starting') this.#fail('Kimi Code local service did not become ready in time.');
    }, timeout);
  }

  stop(): void {
    this.#clearTimeout();
    const child = this.#child;
    this.#child = undefined;
    this.#token = undefined;
    this.#diagnostic = '';
    this.#outputBuffer = '';
    if (child) child.kill();
    this.#setStatus({ kind: 'idle' });
  }

  #handleOutput(chunk: string): void {
    this.#outputBuffer = `${this.#outputBuffer}${chunk}`.slice(-12_000);
    const access = parseStartupAccess(this.#outputBuffer);
    if (access) {
      this.#clearTimeout();
      this.#token = access.token;
      this.#setStatus({ kind: 'connected', origin: access.origin });
    }

    const lines = this.#outputBuffer.split(/\r?\n/);
    this.#outputBuffer = lines.pop() ?? '';
    for (const line of lines) this.#recordDiagnostic(`${line}\n`);
  }

  #recordDiagnostic(text: string): void {
    this.#diagnostic = `${this.#diagnostic}${redactStartupLine(text)}`.slice(-4_000);
  }

  #fail(message: string): void {
    this.#clearTimeout();
    const child = this.#child;
    this.#child = undefined;
    this.#token = undefined;
    this.#outputBuffer = '';
    if (child) child.kill();
    this.#setStatus({ kind: 'failed', message });
  }

  #clearTimeout(): void {
    if (this.#timeout) clearTimeout(this.#timeout);
    this.#timeout = undefined;
  }

  #setStatus(status: ServerStatus): void {
    this.#status = status;
    for (const listener of this.#listeners) listener(status);
  }
}

function isSuccessEnvelope(value: unknown): value is { code: 0; data: unknown } {
  return typeof value === 'object' && value !== null && 'code' in value && (value as { code?: unknown }).code === 0 && 'data' in value;
}
