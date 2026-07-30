import type { DesktopTaskEvent } from '../../shared/contracts';

interface SocketEvent {
  readonly data?: unknown;
}

export interface LiveTaskSocket {
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (event: SocketEvent) => void): void;
}

export interface LiveTaskFeedOptions {
  readonly openSocket: () => LiveTaskSocket;
  readonly debounceMs?: number;
  readonly reconnectDelayMs?: number;
}

interface WatchTarget {
  readonly sessionId: string;
  readonly agentId: string;
}

export class LiveTaskFeed {
  #socket: LiveTaskSocket | undefined;
  #target: WatchTarget | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  #latestSeq: number | undefined;
  #listeners = new Set<(event: DesktopTaskEvent) => void>();

  constructor(private readonly options: LiveTaskFeedOptions) {}

  onRefresh(listener: (event: DesktopTaskEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  watch(sessionId: string, agentId: string): void {
    if (this.#target?.sessionId === sessionId && this.#target.agentId === agentId) return;
    this.unwatch();
    this.#target = { sessionId, agentId };
    this.#connect();
  }

  unwatch(sessionId?: string): void {
    if (sessionId !== undefined && this.#target?.sessionId !== sessionId) return;
    this.#clearTimer();
    this.#clearReconnectTimer();
    this.#latestSeq = undefined;
    const socket = this.#socket;
    this.#socket = undefined;
    this.#target = undefined;
    socket?.close();
  }

  dispose(): void {
    this.unwatch();
    this.#listeners.clear();
  }

  #connect(): void {
    if (!this.#target || this.#socket || this.#reconnectTimer) return;
    try {
      const socket = this.options.openSocket();
      this.#socket = socket;
      socket.addEventListener('message', (event) => this.#handleMessage(socket, event.data));
      socket.addEventListener('close', () => this.#handleClose(socket));
      socket.addEventListener('error', () => this.#handleClose(socket));
    } catch {
      this.#scheduleReconnect();
    }
  }

  #scheduleReconnect(): void {
    if (!this.#target || this.#socket || this.#reconnectTimer) return;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined;
      this.#connect();
    }, this.options.reconnectDelayMs ?? 500);
  }

  #subscribe(socket: LiveTaskSocket): void {
    const target = this.#target;
    if (!target || socket !== this.#socket) return;
    socket.send(JSON.stringify({
      type: 'subscribe_v2',
      id: crypto.randomUUID(),
      payload: {
        session_id: target.sessionId,
        transcript: { [target.agentId]: 'block' },
      },
    }));
  }

  #handleMessage(socket: LiveTaskSocket, raw: unknown): void {
    if (socket !== this.#socket || typeof raw !== 'string') return;
    const frame = parseFrame(raw);
    if (!frame) return;
    if (frame.type === 'server_hello') {
      this.#subscribe(socket);
      return;
    }

    const target = this.#target;
    if (!target || !isRelevantFrame(frame, target)) return;
    this.#queueRefresh(readSequence(frame.payload));
  }

  #handleClose(socket: LiveTaskSocket): void {
    if (socket !== this.#socket) return;
    this.#socket = undefined;
    this.#queueRefresh();
    this.#scheduleReconnect();
  }

  #queueRefresh(seq?: number): void {
    const target = this.#target;
    if (!target) return;
    if (seq !== undefined) this.#latestSeq = seq;
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      const current = this.#target;
      if (!current) return;
      const event: DesktopTaskEvent = {
        sessionId: current.sessionId,
        kind: 'refresh',
        seq: this.#latestSeq,
      };
      this.#latestSeq = undefined;
      for (const listener of this.#listeners) listener(event);
    }, this.options.debounceMs ?? 120);
  }

  #clearTimer(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #clearReconnectTimer(): void {
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;
  }
}

function parseFrame(value: string): { type: string; payload: Record<string, unknown> } | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || typeof parsed.type !== 'string') return undefined;
    return { type: parsed.type, payload: isRecord(parsed.payload) ? parsed.payload : {} };
  } catch {
    return undefined;
  }
}

function isRelevantFrame(frame: { type: string; payload: Record<string, unknown> }, target: WatchTarget): boolean {
  if (frame.type === 'transcript.ops' || frame.type === 'transcript.reset') {
    const agentId = frame.payload.agent_id;
    return agentId === undefined || agentId === target.agentId;
  }
  if (frame.type === 'event.session.work_changed' || frame.type === 'resync_required') {
    const sessionId = frame.payload.session_id;
    return sessionId === undefined || sessionId === target.sessionId;
  }
  return false;
}

function readSequence(value: Record<string, unknown>): number | undefined {
  const seq = value.seq;
  return typeof seq === 'number' && Number.isInteger(seq) && seq >= 0 ? seq : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
