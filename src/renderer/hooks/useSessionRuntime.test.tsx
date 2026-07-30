import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopSessionRuntime } from '../../shared/contracts';
import { useSessionRuntime } from './useSessionRuntime';

const runtime = (model: string, permission: 'manual' | 'yolo' | 'auto' = 'manual'): DesktopSessionRuntime => ({
  available: true,
  model,
  thinkingLevel: 'high',
  permission,
  planMode: false,
  swarmMode: false,
  contextTokens: 10,
  maxContextTokens: 100,
  contextUsage: 0.1,
  warnings: [],
});

const desktopApi = {
  getSessionRuntime: vi.fn<(sessionId: string) => Promise<DesktopSessionRuntime>>(),
  updateSessionRuntime: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'desktop', { configurable: true, value: desktopApi });
});

describe('useSessionRuntime', () => {
  it('ignores a late response from the previously selected session', async () => {
    let resolveFirst!: (value: DesktopSessionRuntime) => void;
    desktopApi.getSessionRuntime
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(runtime('model-2'));

    const { result, rerender } = renderHook(({ sessionId }) => useSessionRuntime(true, sessionId), {
      initialProps: { sessionId: 'session-1' as string | undefined },
    });
    rerender({ sessionId: 'session-2' });

    await waitFor(() => expect(result.current.runtime?.model).toBe('model-2'));
    await act(async () => resolveFirst(runtime('model-1')));
    expect(result.current.runtime?.model).toBe('model-2');
  });

  it('stores only the server-confirmed runtime returned by an update', async () => {
    desktopApi.getSessionRuntime.mockResolvedValue(runtime('model-1'));
    desktopApi.updateSessionRuntime.mockResolvedValue(runtime('model-1', 'auto'));
    const { result } = renderHook(() => useSessionRuntime(true, 'session-1'));
    await waitFor(() => expect(result.current.runtime?.permission).toBe('manual'));

    await act(async () => result.current.update({ permission: 'auto' }));

    expect(desktopApi.updateSessionRuntime).toHaveBeenCalledWith({ sessionId: 'session-1', permission: 'auto' });
    expect(result.current.runtime?.permission).toBe('auto');
  });

  it('coalesces repeated scheduled refreshes', async () => {
    vi.useFakeTimers();
    desktopApi.getSessionRuntime.mockResolvedValue(runtime('model-1'));
    const { result } = renderHook(() => useSessionRuntime(true, 'session-1'));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(desktopApi.getSessionRuntime).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.scheduleRefresh();
      result.current.scheduleRefresh();
      result.current.scheduleRefresh();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(160); });

    expect(desktopApi.getSessionRuntime).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
