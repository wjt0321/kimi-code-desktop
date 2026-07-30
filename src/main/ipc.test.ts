import { describe, expect, it, vi } from 'vitest';

import type { CliDiscovery, ServerStatus } from '../shared/contracts';
import { DesktopController } from './ipc';

function readyCli(): CliDiscovery {
  return { kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' };
}

function fakeLifecycle(status: ServerStatus = { kind: 'idle' }) {
  let current = status;
  const listeners = new Set<(next: ServerStatus) => void>();
  return {
    snapshot: () => current,
    start: vi.fn(async () => { current = { kind: 'starting', command: 'C:\\tools\\kimi.cmd' }; listeners.forEach((listener) => listener(current)); }),
    stop: vi.fn(() => { current = { kind: 'idle' }; listeners.forEach((listener) => listener(current)); }),
    onStatus: (listener: (next: ServerStatus) => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    setStatus: (next: ServerStatus) => { current = next; listeners.forEach((listener) => listener(current)); },
  };
}

describe('DesktopController', () => {
  it('rejects service start until discovery reports a ready CLI', async () => {
    const lifecycle = fakeLifecycle();
    const controller = new DesktopController({ discover: async () => ({ kind: 'missing' }), validate: async () => ({ kind: 'missing' }), lifecycle, feed: fakeFeed() });

    await controller.refreshCli();
    await expect(controller.startServer()).rejects.toThrow('Kimi Code CLI is not ready');
  });

  it('uses a selected launcher only after validating it', async () => {
    const lifecycle = fakeLifecycle();
    const controller = new DesktopController({ discover: async () => ({ kind: 'missing' }), validate: async () => readyCli(), lifecycle, feed: fakeFeed() });

    await controller.chooseCliExecutable('C:\\tools\\kimi.cmd');

    expect(controller.status()).toEqual({ cli: readyCli(), server: { kind: 'idle' } });
  });
});


function fakeFeed() {
  const listeners = new Set<(event: { sessionId: string; kind: 'refresh'; seq?: number }) => void>();
  return {
    watch: vi.fn(),
    unwatch: vi.fn(),
    onRefresh: (listener: (event: { sessionId: string; kind: 'refresh'; seq?: number }) => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    emit: (event: { sessionId: string; kind: 'refresh'; seq?: number }) => listeners.forEach((listener) => listener(event)),
  };
}

describe('task watching', () => {
  it('starts a watched task only after the local service is connected', async () => {
    const lifecycle = fakeLifecycle();
    const feed = fakeFeed();
    const controller = new DesktopController({ discover: async () => readyCli(), validate: async () => readyCli(), lifecycle, feed });

    await expect(controller.watchTask('session-1', 'main')).rejects.toThrow('Kimi Code local service is not connected.');
    lifecycle.setStatus({ kind: 'connected', origin: 'http://127.0.0.1:58627' });
    await controller.watchTask('session-1', 'main');

    expect(feed.watch).toHaveBeenCalledWith('session-1', 'main');
  });
});
