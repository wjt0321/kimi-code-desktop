import { useCallback, useEffect, useState } from 'react';

import type { DesktopThemeSnapshot, ThemePreference } from '../../shared/contracts';

const initialTheme: DesktopThemeSnapshot = {
  preference: 'system',
  resolved: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
};

export function useDesktopTheme() {
  const [theme, setThemeSnapshot] = useState(initialTheme);

  useEffect(() => {
    let active = true;
    const api = window.desktop;
    if (typeof api.theme !== 'function' || typeof api.onTheme !== 'function') return () => { active = false; };
    void api.theme().then((next) => {
      if (!active) return;
      applyTheme(next);
      setThemeSnapshot(next);
    });
    const unsubscribe = api.onTheme((next) => {
      if (!active) return;
      applyTheme(next);
      setThemeSnapshot(next);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const setTheme = useCallback(async (preference: ThemePreference) => {
    if (typeof window.desktop.setTheme !== 'function') return initialTheme;
    const next = await window.desktop.setTheme({ preference });
    applyTheme(next);
    setThemeSnapshot(next);
    return next;
  }, []);

  return { theme, setTheme };
}

function applyTheme(theme: DesktopThemeSnapshot): void {
  document.documentElement.dataset.theme = theme.resolved;
  document.documentElement.style.colorScheme = theme.resolved;
}
