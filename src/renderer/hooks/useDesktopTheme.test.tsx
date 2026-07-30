import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopThemeSnapshot } from '../../shared/contracts';
import { useDesktopTheme } from './useDesktopTheme';

const dark: DesktopThemeSnapshot = { preference: 'system', resolved: 'dark' };
const light: DesktopThemeSnapshot = { preference: 'light', resolved: 'light' };
const api = {
  theme: vi.fn(async () => dark),
  setTheme: vi.fn(async () => light),
  onTheme: vi.fn<(listener: (value: DesktopThemeSnapshot) => void) => () => void>(),
};

beforeEach(() => {
  vi.clearAllMocks();
  api.theme.mockResolvedValue(dark);
  api.setTheme.mockResolvedValue(light);
  api.onTheme.mockImplementation(() => () => undefined);
  Object.defineProperty(window, 'desktop', { configurable: true, value: api });
});

describe('useDesktopTheme', () => {
  it('loads and applies theme snapshots and user changes', async () => {
    const { result } = renderHook(() => useDesktopTheme());
    await waitFor(() => expect(result.current.theme).toEqual(dark));
    await act(async () => { await result.current.setTheme('light'); });
    expect(result.current.theme).toEqual(light);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
