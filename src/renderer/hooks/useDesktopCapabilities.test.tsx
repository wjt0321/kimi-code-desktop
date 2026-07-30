import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopCapabilitySnapshot } from '../../shared/contracts';
import { useDesktopCapabilities } from './useDesktopCapabilities';

const idleCapabilities: DesktopCapabilitySnapshot = {
  phase: 'idle',
  desktopVersion: '0.5.0',
  compatibilityMode: false,
  capabilities: {
    sessionRuntime: 'unknown',
    sessionWarnings: 'unknown',
    transcript: 'unknown',
    config: 'unknown',
    secondaryModel: 'unknown',
    managedUserInfo: 'unknown',
    promptProfile: 'unknown',
    nonBlockingTaskOutput: 'unknown',
  },
};

const readyCapabilities: DesktopCapabilitySnapshot = {
  ...idleCapabilities,
  phase: 'ready',
  cliVersion: '0.30.0',
  compatibilityMode: true,
};

const desktopApi = {
  capabilities: vi.fn<() => Promise<DesktopCapabilitySnapshot>>(),
  refreshCapabilities: vi.fn<() => Promise<DesktopCapabilitySnapshot>>(),
  onCapabilities: vi.fn<(listener: (snapshot: DesktopCapabilitySnapshot) => void) => () => void>(),
};

beforeEach(() => {
  vi.clearAllMocks();
  desktopApi.capabilities.mockResolvedValue(idleCapabilities);
  desktopApi.refreshCapabilities.mockResolvedValue(readyCapabilities);
  desktopApi.onCapabilities.mockImplementation(() => () => undefined);
  Object.defineProperty(window, 'desktop', { configurable: true, value: desktopApi });
});

describe('useDesktopCapabilities', () => {
  it('loads the initial snapshot and applies pushed updates', async () => {
    let push!: (snapshot: DesktopCapabilitySnapshot) => void;
    desktopApi.onCapabilities.mockImplementation((listener) => {
      push = listener;
      return () => undefined;
    });
    const { result } = renderHook(() => useDesktopCapabilities());
    await waitFor(() => expect(desktopApi.capabilities).toHaveBeenCalledTimes(1));

    act(() => push(readyCapabilities));

    expect(result.current.capabilities).toEqual(readyCapabilities);
  });

  it('stores the server-confirmed snapshot returned by manual refresh', async () => {
    const { result } = renderHook(() => useDesktopCapabilities());
    await waitFor(() => expect(result.current.capabilities.phase).toBe('idle'));

    await act(async () => result.current.refreshCapabilities());

    expect(desktopApi.refreshCapabilities).toHaveBeenCalledTimes(1);
    expect(result.current.capabilities).toEqual(readyCapabilities);
  });
});
