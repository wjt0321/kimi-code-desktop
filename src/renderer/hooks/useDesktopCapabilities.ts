import { useCallback, useEffect, useState } from 'react';

import type { DesktopCapabilitySnapshot } from '../../shared/contracts';

const initialCapabilities: DesktopCapabilitySnapshot = {
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

export function useDesktopCapabilities() {
  const [capabilities, setCapabilities] = useState<DesktopCapabilitySnapshot>(initialCapabilities);

  useEffect(() => {
    let active = true;
    void window.desktop.capabilities().then((next) => {
      if (active) setCapabilities(next);
    });
    const unsubscribe = window.desktop.onCapabilities((next) => {
      if (active) setCapabilities(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const refreshCapabilities = useCallback(async () => {
    const next = await window.desktop.refreshCapabilities();
    setCapabilities(next);
    return next;
  }, []);

  return { capabilities, refreshCapabilities };
}
