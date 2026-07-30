import { useCallback, useEffect, useRef, useState } from 'react';

import type { DesktopSessionRuntime, UpdateRuntimeRequest } from '../../shared/contracts';

export function useSessionRuntime(connected: boolean, sessionId: string | undefined) {
  const [runtime, setRuntime] = useState<DesktopSessionRuntime>();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string>();
  const sessionIdRef = useRef(sessionId);
  const requestRevision = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updateQueue = useRef<Promise<void>>(Promise.resolve());
  sessionIdRef.current = sessionId;

  const refresh = useCallback(async () => {
    if (!connected || !sessionId) {
      setRuntime(undefined);
      return;
    }
    const revision = ++requestRevision.current;
    setLoading(true);
    try {
      const next = await window.desktop.getSessionRuntime(sessionId);
      if (revision !== requestRevision.current || sessionIdRef.current !== sessionId) return;
      setRuntime(next);
      setError(undefined);
    } catch (cause) {
      if (revision !== requestRevision.current || sessionIdRef.current !== sessionId) return;
      setError(cause instanceof Error ? cause.message : '无法读取当前任务的运行状态。');
    } finally {
      if (revision === requestRevision.current && sessionIdRef.current === sessionId) setLoading(false);
    }
  }, [connected, sessionId]);

  const scheduleRefresh = useCallback(() => {
    if (!connected || !sessionId) return;
    if (refreshTimer.current !== undefined) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = undefined;
      void refresh();
    }, 120);
  }, [connected, refresh, sessionId]);

  const update = useCallback((patch: Omit<UpdateRuntimeRequest, 'sessionId'>): Promise<void> => {
    if (!connected || !sessionId) return Promise.resolve();
    const targetSessionId = sessionId;
    const operation = updateQueue.current.catch(() => undefined).then(async () => {
      setUpdating(true);
      try {
        const confirmed = await window.desktop.updateSessionRuntime({ sessionId: targetSessionId, ...patch });
        if (sessionIdRef.current === targetSessionId) {
          setRuntime(confirmed);
          setError(undefined);
        }
      } catch (cause) {
        if (sessionIdRef.current === targetSessionId) {
          setError(cause instanceof Error ? cause.message : '无法更新当前任务的运行策略。');
        }
        throw cause;
      } finally {
        if (sessionIdRef.current === targetSessionId) setUpdating(false);
      }
    });
    updateQueue.current = operation;
    return operation;
  }, [connected, sessionId]);

  useEffect(() => {
    requestRevision.current += 1;
    setRuntime(undefined);
    setError(undefined);
    if (!connected || !sessionId) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [connected, refresh, sessionId]);

  useEffect(() => () => {
    requestRevision.current += 1;
    if (refreshTimer.current !== undefined) clearTimeout(refreshTimer.current);
  }, []);

  return { runtime, loading, updating, error, refresh, scheduleRefresh, update };
}
