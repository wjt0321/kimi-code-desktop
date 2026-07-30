import { useCallback, useEffect, useState } from 'react';

import type { DesktopStatus } from '../../shared/contracts';

const initialStatus: DesktopStatus = { cli: { kind: 'checking' }, server: { kind: 'idle' } };

export function useDesktopStatus() {
  const [status, setStatus] = useState<DesktopStatus>(initialStatus);

  useEffect(() => {
    let active = true;
    void window.desktop.status().then((next) => {
      if (active) setStatus(next);
    });

    return window.desktop.onStatus((next) => {
      if (active) setStatus(next);
    });
  }, []);

  const refreshCli = useCallback(async () => setStatus(await window.desktop.refreshCli()), []);
  const chooseCliExecutable = useCallback(async () => setStatus(await window.desktop.chooseCliExecutable()), []);
  const startServer = useCallback(async () => setStatus(await window.desktop.startServer()), []);
  const stopServer = useCallback(async () => setStatus(await window.desktop.stopServer()), []);

  return { status, refreshCli, chooseCliExecutable, startServer, stopServer };
}
