import { useCallback, useEffect, useState } from 'react';

import type { DesktopCliUpdateSnapshot } from '../../shared/contracts';

export const initialCliUpdateSnapshot: DesktopCliUpdateSnapshot = {
  phase: 'idle',
  canAutoInstall: false,
  updateAvailable: false,
};

export function useCliUpdate() {
  const [snapshot, setSnapshot] = useState<DesktopCliUpdateSnapshot>(initialCliUpdateSnapshot);

  useEffect(() => {
    let active = true;
    const api = window.desktop;
    if (typeof api.cliUpdate !== 'function' || typeof api.onCliUpdate !== 'function') {
      return () => { active = false; };
    }
    void api.cliUpdate().then((next) => {
      if (active) setSnapshot(next);
    });
    const unsubscribe = api.onCliUpdate((next) => {
      if (active) setSnapshot(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const check = useCallback(async (force = true) => {
    if (typeof window.desktop.checkCliUpdate !== 'function') return initialCliUpdateSnapshot;
    const next = await window.desktop.checkCliUpdate(force);
    setSnapshot(next);
    return next;
  }, []);

  const install = useCallback(async () => {
    if (typeof window.desktop.installCliUpdate !== 'function') return initialCliUpdateSnapshot;
    const next = await window.desktop.installCliUpdate();
    setSnapshot(next);
    return next;
  }, []);

  return { snapshot, check, install };
}
