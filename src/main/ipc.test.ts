import { describe, expect, it, vi } from 'vitest';

import type { CliDiscovery, ServerStatus } from '../shared/contracts';
import { createReviewIpcHandlers, createSessionIpcHandlers, DesktopController } from './ipc';

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


describe('session IPC handlers', () => {
  it('validates runtime and lifecycle inputs before forwarding them', async () => {
    const client = {
      listArchivedSessions: vi.fn(async () => []),
      getSessionRuntime: vi.fn(async () => ({
        available: true,
        thinkingLevel: 'off',
        permission: 'manual' as const,
        planMode: false,
        swarmMode: false,
        contextTokens: 0,
        maxContextTokens: 0,
        contextUsage: 0,
        warnings: [],
      })),
      updateSessionRuntime: vi.fn(async (input) => ({
        available: true,
        thinkingLevel: input.thinkingLevel ?? 'off',
        permission: input.permission ?? 'manual',
        planMode: input.planMode ?? false,
        swarmMode: false,
        contextTokens: 0,
        maxContextTokens: 0,
        contextUsage: 0,
        warnings: [],
      })),
      compactSession: vi.fn(async () => undefined),
      undoSession: vi.fn(async () => undefined),
      forkSession: vi.fn(async () => ({ id: 'forked', title: '派生任务', updatedAt: '2026-07-30T00:00:00.000Z', busy: false, cwd: 'C:\\repo' })),
      restoreSession: vi.fn(async () => ({ id: 'restored', title: '恢复任务', updatedAt: '2026-07-30T00:00:00.000Z', busy: false, cwd: 'C:\\repo' })),
    };
    const handlers = createSessionIpcHandlers(client);

    await expect(handlers.updateRuntime({ sessionId: 's1' })).rejects.toThrow('必须提供至少一项运行策略更新');
    expect(client.updateSessionRuntime).not.toHaveBeenCalled();

    await handlers.updateRuntime({ sessionId: 's1', permission: 'auto' });
    await handlers.compact({ sessionId: 's1', instruction: ' 保留决策 ' });
    await handlers.undo({ sessionId: 's1' });
    await handlers.fork({ sessionId: 's1', title: ' 派生任务 ' });
    await handlers.restore({ sessionId: 's1' });

    expect(client.updateSessionRuntime).toHaveBeenCalledWith({ sessionId: 's1', permission: 'auto' });
    expect(client.compactSession).toHaveBeenCalledWith({ sessionId: 's1', instruction: '保留决策' });
    expect(client.undoSession).toHaveBeenCalledWith({ sessionId: 's1', count: 1 });
    expect(client.forkSession).toHaveBeenCalledWith({ sessionId: 's1', title: '派生任务' });
    expect(client.restoreSession).toHaveBeenCalledWith({ sessionId: 's1' });
  });
});
describe('review IPC handlers', () => {
  it('reveals an existing absolute path and copies bounded text', async () => {
    const actions = {
      exists: vi.fn(() => true),
      reveal: vi.fn(),
      copy: vi.fn(),
    };
    const handlers = createReviewIpcHandlers(actions);

    await handlers.reveal({ path: 'D:\\repo\\src\\app.ts' });
    await handlers.copy({ text: 'diff content' });

    expect(actions.reveal).toHaveBeenCalledWith('D:\\repo\\src\\app.ts');
    expect(actions.copy).toHaveBeenCalledWith('diff content');
  });

  it('rejects relative and missing paths before invoking Electron', async () => {
    const actions = {
      exists: vi.fn(() => false),
      reveal: vi.fn(),
      copy: vi.fn(),
    };
    const handlers = createReviewIpcHandlers(actions);

    await expect(handlers.reveal({ path: 'src/app.ts' })).rejects.toThrow('必须提供绝对路径');
    await expect(handlers.reveal({ path: 'D:\\missing.ts' })).rejects.toThrow('路径不存在');
    expect(actions.reveal).not.toHaveBeenCalled();
  });
});
