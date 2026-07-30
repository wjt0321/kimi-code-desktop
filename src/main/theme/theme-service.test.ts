import { describe, expect, it, vi } from 'vitest';

import type { ThemePreference } from '../../shared/contracts';
import { DesktopThemeService, type NativeThemePort } from './theme-service';

function setup(preference: ThemePreference = 'system', dark = false) {
  let listener: (() => void) | undefined;
  const native: NativeThemePort = {
    themeSource: 'system',
    shouldUseDarkColors: dark,
    on: vi.fn((_event, next) => { listener = next; }),
    off: vi.fn(),
  };
  const store = {
    read: vi.fn(async () => ({ theme: preference })),
    write: vi.fn(async (patch: { theme?: ThemePreference }) => ({ theme: patch.theme ?? preference })),
  };
  return { service: new DesktopThemeService(native, store), native, store, update: () => listener?.() };
}

describe('DesktopThemeService', () => {
  it('initializes system preference from native dark colors', async () => {
    const { service, native } = setup('system', true);
    await expect(service.initialize()).resolves.toEqual({ preference: 'system', resolved: 'dark' });
    expect(native.themeSource).toBe('system');
  });

  it('persists explicit themes and emits the resolved snapshot', async () => {
    const { service, store } = setup();
    await service.initialize();
    const listener = vi.fn();
    service.onSnapshot(listener);

    await expect(service.setPreference('light')).resolves.toEqual({ preference: 'light', resolved: 'light' });
    expect(store.write).toHaveBeenCalledWith({ theme: 'light' });
    expect(listener).toHaveBeenCalledWith({ preference: 'light', resolved: 'light' });
  });

  it('emits native changes only for system preference', async () => {
    const { service, native, update } = setup('system', false);
    await service.initialize();
    const listener = vi.fn();
    service.onSnapshot(listener);
    Object.defineProperty(native, 'shouldUseDarkColors', { configurable: true, value: true });
    update();
    expect(listener).toHaveBeenCalledWith({ preference: 'system', resolved: 'dark' });

    await service.setPreference('light');
    listener.mockClear();
    update();
    expect(listener).not.toHaveBeenCalled();
  });
});
