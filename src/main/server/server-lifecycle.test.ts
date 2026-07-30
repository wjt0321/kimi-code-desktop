import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { KimiServerLifecycle, LocalServiceRequestError, type ChildProcessFactory, type ManagedChild } from './server-lifecycle';

function fakeChild(): ManagedChild & { readonly args: readonly string[]; emitExit(code: number): void; emitError(): void } {
  const events = new EventEmitter();
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  return {
    args: [],
    stdout,
    stderr,
    kill: vi.fn(() => true),
    once: events.once.bind(events),
    emitExit: (code) => events.emit('exit', code),
    emitError: () => events.emit('error', new Error('startup failure')),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('KimiServerLifecycle', () => {
  it('starts Kimi only with safe web command arguments', async () => {
    const child = fakeChild();
    const factory: ChildProcessFactory = { spawn: vi.fn(() => child) };
    const lifecycle = new KimiServerLifecycle({ childFactory: factory, portProvider: async () => 59123 });

    await lifecycle.start({ kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' });

    expect(factory.spawn).toHaveBeenCalledWith('C:\\tools\\kimi.cmd', ['web', '--no-open', '--port', '59123']);
  });

  it('reports a loopback origin while redacting a fragmented token from diagnostics', async () => {
    const child = fakeChild();
    const lifecycle = new KimiServerLifecycle({ childFactory: { spawn: () => child }, portProvider: async () => 59123 });
    await lifecycle.start({ kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' });

    child.stdout.emit('data', Buffer.from('Open http://127.0.0.1:59123/#token=secret-'));
    child.stdout.emit('data', Buffer.from('value\n'));

    expect(lifecycle.snapshot()).toEqual({ kind: 'connected', origin: 'http://127.0.0.1:59123' });
    expect(lifecycle.lastDiagnostic()).not.toContain('secret-value');
  });

  it('keeps the startup token in the main-process request path only', async () => {
    const child = fakeChild();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: 0, data: { items: [] } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const lifecycle = new KimiServerLifecycle({ childFactory: { spawn: () => child }, portProvider: async () => 59123 });
    await lifecycle.start({ kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' });
    child.stdout.emit('data', Buffer.from('Open http://127.0.0.1:59123/#token=fixture-token\n'));

    await expect(lifecycle.request('/sessions')).resolves.toEqual({ items: [] });
    expect(lifecycle.snapshot()).toEqual({ kind: 'connected', origin: 'http://127.0.0.1:59123' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://127.0.0.1:59123/api/v1/sessions' }),
      expect.objectContaining({ headers: { Authorization: 'Bearer fixture-token' } }),
    );
  });

  it('preserves HTTP status and service error details for failed requests', async () => {
    const child = fakeChild();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({ code: 40401, msg: 'route not found', details: { path: '/sessions/s1/status' } }),
    })));
    const lifecycle = new KimiServerLifecycle({ childFactory: { spawn: () => child }, portProvider: async () => 59123 });
    await lifecycle.start({ kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' });
    child.stdout.emit('data', Buffer.from('Open http://127.0.0.1:59123/#token=fixture-token\n'));

    await expect(lifecycle.request('/sessions/s1/status')).rejects.toEqual(
      new LocalServiceRequestError('route not found', 404, 40401, { path: '/sessions/s1/status' }),
    );
  });

  it('preserves HTTP status when a failed response is not JSON', async () => {
    const child = fakeChild();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('invalid json'); },
    })));
    const lifecycle = new KimiServerLifecycle({ childFactory: { spawn: () => child }, portProvider: async () => 59123 });
    await lifecycle.start({ kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' });
    child.stdout.emit('data', Buffer.from('Open http://127.0.0.1:59123/#token=fixture-token\n'));

    await expect(lifecycle.request('/sessions')).rejects.toMatchObject({
      name: 'LocalServiceRequestError',
      status: 502,
      message: 'Kimi Code 本地服务返回了无效响应。',
    });
  });

  it('stops an owned process when startup fails', async () => {
    const child = fakeChild();
    const lifecycle = new KimiServerLifecycle({ childFactory: { spawn: () => child }, portProvider: async () => 59123 });
    await lifecycle.start({ kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' });

    child.emitError();

    expect(child.kill).toHaveBeenCalledOnce();
    expect(lifecycle.snapshot()).toEqual({ kind: 'failed', message: 'Kimi Code local service could not start.' });
  });

  it('does not stop a process it did not create', () => {
    const lifecycle = new KimiServerLifecycle({ childFactory: { spawn: vi.fn() }, portProvider: async () => 59123 });

    lifecycle.stop();

    expect(lifecycle.snapshot()).toEqual({ kind: 'idle' });
  });
});

  it('opens the realtime socket in the main process with the bearer subprotocol', async () => {
    const child = fakeChild();
    const socket = { addEventListener: vi.fn(), send: vi.fn(), close: vi.fn() };
    const WebSocketConstructor = vi.fn(function WebSocketConstructor() { return socket; });
    vi.stubGlobal('WebSocket', WebSocketConstructor);
    const lifecycle = new KimiServerLifecycle({ childFactory: { spawn: () => child }, portProvider: async () => 59123 });
    await lifecycle.start({ kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' });
    child.stdout.emit('data', Buffer.from('Open http://127.0.0.1:59123/#token=fixture-token\n'));

    expect(lifecycle.openEventSocket()).toBe(socket);
    expect(WebSocketConstructor).toHaveBeenCalledWith('ws://127.0.0.1:59123/api/v1/ws', ['kimi-code.bearer.fixture-token']);
    expect(lifecycle.lastDiagnostic()).not.toContain('fixture-token');
  });
