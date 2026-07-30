import { describe, expect, it, vi } from 'vitest';

import { LiveTaskFeed, type LiveTaskSocket } from './live-task-feed';

function createSocket(): LiveTaskSocket & { readonly sent: string[]; emit(type: 'open' | 'message' | 'close', data?: unknown): void } {
  const listeners = new Map<string, Set<(event: { data?: unknown }) => void>>();
  return {
    sent: [],
    send(data: string) { this.sent.push(data); },
    close: vi.fn(),
    addEventListener(type, listener) {
      const values = listeners.get(type) ?? new Set();
      values.add(listener);
      listeners.set(type, values);
    },
    emit(type, data) {
      for (const listener of listeners.get(type) ?? []) listener({ data });
    },
  };
}

describe('LiveTaskFeed', () => {
  it('subscribes after hello and coalesces transcript bursts into one refresh event', () => {
    vi.useFakeTimers();
    const socket = createSocket();
    const openSocket = vi.fn(() => socket);
    const listener = vi.fn();
    const feed = new LiveTaskFeed({ openSocket, debounceMs: 25 });
    feed.onRefresh(listener);

    feed.watch('session-1', 'main');
    socket.emit('open');
    socket.emit('message', JSON.stringify({ type: 'server_hello', payload: {} }));
    socket.emit('message', JSON.stringify({ type: 'transcript.ops', payload: { agent_id: 'main', seq: 7, ops: [] } }));
    socket.emit('message', JSON.stringify({ type: 'transcript.ops', payload: { agent_id: 'main', seq: 8, ops: [] } }));
    vi.advanceTimersByTime(25);

    expect(openSocket).toHaveBeenCalledOnce();
    expect(socket.sent).toEqual([expect.stringContaining('subscribe_v2')]);
    expect(listener).toHaveBeenCalledWith({ sessionId: 'session-1', kind: 'refresh', seq: 8 });
    expect(JSON.stringify(listener.mock.calls)).not.toContain('secret-token');
    vi.useRealTimers();
  });

  it('closes the active socket when the watched task changes', () => {
    const first = createSocket();
    const second = createSocket();
    const openSocket = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const feed = new LiveTaskFeed({ openSocket });

    feed.watch('session-1', 'main');
    feed.watch('session-2', 'main');

    expect(first.close).toHaveBeenCalledOnce();
    expect(openSocket).toHaveBeenCalledTimes(2);
  });

  it('reconnects and restores the selected task subscription after the socket closes', () => {
    vi.useFakeTimers();
    const first = createSocket();
    const second = createSocket();
    const openSocket = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const feed = new LiveTaskFeed({ openSocket, reconnectDelayMs: 40 });

    feed.watch('session-1', 'main');
    first.emit('message', JSON.stringify({ type: 'server_hello', payload: {} }));
    first.emit('close');
    vi.advanceTimersByTime(40);
    second.emit('message', JSON.stringify({ type: 'server_hello', payload: {} }));

    expect(openSocket).toHaveBeenCalledTimes(2);
    expect(second.sent).toEqual([expect.stringContaining('subscribe_v2')]);
    vi.useRealTimers();
  });
});
