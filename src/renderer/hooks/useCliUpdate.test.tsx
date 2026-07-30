import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopCliUpdateSnapshot } from '../../shared/contracts';
import { useCliUpdate } from './useCliUpdate';

const idle: DesktopCliUpdateSnapshot = {
  phase: 'idle',
  canAutoInstall: false,
  updateAvailable: false,
};
const available: DesktopCliUpdateSnapshot = {
  phase: 'available',
  currentVersion: '0.30.0',
  latestVersion: '0.31.0',
  installSource: 'npm-global',
  installCommand: 'npm install --global @moonshot-ai/kimi-code@0.31.0',
  canAutoInstall: true,
  updateAvailable: true,
};
const succeeded: DesktopCliUpdateSnapshot = {
  ...available,
  phase: 'succeeded',
  currentVersion: '0.31.0',
  canAutoInstall: false,
  updateAvailable: false,
};

const api = {
  cliUpdate: vi.fn(async () => idle),
  checkCliUpdate: vi.fn(async () => available),
  installCliUpdate: vi.fn(async () => succeeded),
  onCliUpdate: vi.fn<(listener: (snapshot: DesktopCliUpdateSnapshot) => void) => () => void>(),
};

beforeEach(() => {
  vi.clearAllMocks();
  api.cliUpdate.mockResolvedValue(idle);
  api.checkCliUpdate.mockResolvedValue(available);
  api.installCliUpdate.mockResolvedValue(succeeded);
  api.onCliUpdate.mockImplementation(() => () => undefined);
  Object.defineProperty(window, 'desktop', { configurable: true, value: api });
});

describe('useCliUpdate', () => {
  it('loads snapshots, forces manual checks and installs service-owned updates', async () => {
    const { result } = renderHook(() => useCliUpdate());
    await waitFor(() => expect(api.cliUpdate).toHaveBeenCalledOnce());

    await act(async () => { await result.current.check(true); });
    expect(api.checkCliUpdate).toHaveBeenCalledWith(true);
    expect(result.current.snapshot).toEqual(available);

    await act(async () => { await result.current.install(); });
    expect(result.current.snapshot).toEqual(succeeded);
  });

  it('accepts update events and degrades to idle with an older preload fixture', async () => {
    let listener: ((snapshot: DesktopCliUpdateSnapshot) => void) | undefined;
    api.onCliUpdate.mockImplementation((next) => {
      listener = next;
      return () => undefined;
    });
    const { result, unmount } = renderHook(() => useCliUpdate());
    await waitFor(() => expect(listener).toBeDefined());
    act(() => listener?.(available));
    expect(result.current.snapshot).toEqual(available);
    unmount();

    Object.defineProperty(window, 'desktop', { configurable: true, value: {} });
    const fallback = renderHook(() => useCliUpdate());
    expect(fallback.result.current.snapshot).toEqual(idle);
  });
});
