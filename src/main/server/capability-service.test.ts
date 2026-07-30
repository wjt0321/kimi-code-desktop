import { describe, expect, it, vi } from 'vitest';

import type { DesktopCapabilitySnapshot } from '../../shared/contracts';
import { KimiCapabilityService } from './capability-service';
import { LocalServiceRequestError } from './server-lifecycle';

const fixedNow = () => new Date('2026-07-30T08:00:00.000Z');

describe('KimiCapabilityService', () => {
  it('detects a CLI 0.30 service and keeps newer features unavailable', async () => {
    const request = vi.fn(async (path: string) => {
      if (path === '/meta') return { server_version: '0.30.0' };
      if (path === '/config') return { providers: {} };
      throw new LocalServiceRequestError('Route not found', 404);
    });
    const service = new KimiCapabilityService({ desktopVersion: '0.5.0', request, now: fixedNow });

    const snapshot = await service.refresh('0.30.0');

    expect(snapshot).toMatchObject({
      phase: 'ready',
      desktopVersion: '0.5.0',
      cliVersion: '0.30.0',
      serverVersion: '0.30.0',
      checkedAt: '2026-07-30T08:00:00.000Z',
      compatibilityMode: true,
      capabilities: {
        sessionRuntime: 'supported',
        sessionWarnings: 'supported',
        transcript: 'supported',
        config: 'supported',
        secondaryModel: 'unsupported',
        managedUserInfo: 'unsupported',
        promptProfile: 'unsupported',
        nonBlockingTaskOutput: 'unsupported',
      },
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('treats an unauthenticated userinfo response as route support', async () => {
    const request = vi.fn(async (path: string) => {
      if (path === '/meta') return { server_version: '0.31.1' };
      if (path === '/config') return { providers: {}, secondary_model: {} };
      throw new LocalServiceRequestError('请先登录', 401);
    });
    const service = new KimiCapabilityService({ desktopVersion: '0.5.0', request, now: fixedNow });

    const snapshot = await service.refresh('0.31.1');

    expect(snapshot.compatibilityMode).toBe(false);
    expect(snapshot.capabilities).toMatchObject({
      secondaryModel: 'supported',
      managedUserInfo: 'supported',
      promptProfile: 'supported',
      nonBlockingTaskOutput: 'supported',
    });
  });

  it('keeps transport failures unknown and caches a completed detection', async () => {
    const request = vi.fn(async () => {
      throw new Error('connection reset');
    });
    const service = new KimiCapabilityService({ desktopVersion: '0.5.0', request, now: fixedNow });

    const first = await service.refresh('0.30.0');
    const second = await service.refresh('0.30.0');

    expect(first.capabilities.config).toBe('unknown');
    expect(first.capabilities.managedUserInfo).toBe('unknown');
    expect(second).toBe(first);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('emits detecting and ready snapshots, then invalidates them on reset', async () => {
    const request = vi.fn(async (path: string) => path === '/meta'
      ? { server_version: '0.31.0' }
      : path === '/config'
        ? { providers: {} }
        : { kind: 'error', message: 'not logged in', status: 401 });
    const service = new KimiCapabilityService({ desktopVersion: '0.5.0', request, now: fixedNow });
    const phases: DesktopCapabilitySnapshot['phase'][] = [];
    service.onSnapshot((snapshot) => phases.push(snapshot.phase));

    await service.refresh('0.31.0');
    const idle = service.reset('0.31.0');

    expect(phases).toEqual(['detecting', 'ready', 'idle']);
    expect(idle.capabilities.config).toBe('unknown');
    expect(idle.cliVersion).toBe('0.31.0');
    await service.refresh('0.31.0');
    expect(request).toHaveBeenCalledTimes(6);
  });

  it('lets observed real calls refine a capability without another probe', async () => {
    const service = new KimiCapabilityService({
      desktopVersion: '0.5.0',
      request: async () => { throw new Error('offline'); },
      now: fixedNow,
    });
    await service.refresh('0.30.0');

    service.observe('sessionWarnings', 'supported');

    expect(service.snapshot().capabilities.sessionWarnings).toBe('supported');
  });

  it('ignores a stale detection result after the service is reset', async () => {
    let resolveMeta: ((value: unknown) => void) | undefined;
    const request = vi.fn((path: string) => path === '/meta'
      ? new Promise<unknown>((resolve) => { resolveMeta = resolve; })
      : Promise.resolve({ providers: {} }));
    const service = new KimiCapabilityService({ desktopVersion: '0.5.0', request, now: fixedNow });

    const pending = service.refresh('0.31.0');
    service.reset('0.30.0');
    resolveMeta?.({ server_version: '0.31.0' });
    await pending;

    expect(service.snapshot()).toMatchObject({ phase: 'idle', cliVersion: '0.30.0' });
  });
});
