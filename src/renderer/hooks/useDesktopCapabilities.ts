import { useCallback, useEffect, useState } from 'react';

import type { DesktopCapabilitySnapshot } from '../../shared/contracts';

const initialCapabilities: DesktopCapabilitySnapshot = {
  phase: 'idle',
  desktopVersion: '—',
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

export function useDesktopCapabilities() {
  const [capabilities, setCapabilities] = useState<DesktopCapabilitySnapshot>(initialCapabilities);

  useEffect(() => {
    let active = true;
    const api = window.desktop;
    if (typeof api.capabilities !== 'function' || typeof api.onCapabilities !== 'function') return () => { active = false; };
    void api.capabilities().then((next) => {
      if (active) setCapabilities(next);
    });
    const unsubscribe = api.onCapabilities((next) => {
      if (active) setCapabilities(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const refreshCapabilities = useCallback(async () => {
    if (typeof window.desktop.refreshCapabilities !== 'function') return capabilities;
    const next = await window.desktop.refreshCapabilities();
    setCapabilities(next);
    return next;
  }, [capabilities]);

  return { capabilities, refreshCapabilities };
}
