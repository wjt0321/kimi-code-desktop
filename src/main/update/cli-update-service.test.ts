import { describe, expect, it, vi } from 'vitest';

import type { CliDiscovery, DesktopStatus } from '../../shared/contracts';
import type { CliUpdateCache, CliUpdateCachePatch } from './update-cache';
import { CliUpdateService, type CliUpdateDesktopPort } from './cli-update-service';

const readyCli = (version = '0.30.0'): Extract<CliDiscovery, { kind: 'ready' }> => ({
  kind: 'ready',
  command: 'C:\\Users\\example\\AppData\\Roaming\\npm\\kimi.cmd',
  version,
});

function cache(initial?: Partial<CliUpdateCache>) {
  let value: CliUpdateCache = {
    deviceId: '00000000-0000-4000-8000-000000000001',
    checkedAt: null,
    latest: null,
    manifest: null,
    ...initial,
  };
  return {
    read: vi.fn(async () => value),
    write: vi.fn(async (patch: CliUpdateCachePatch) => {
      value = { ...value, ...patch };
      return value;
    }),
  };
}

function desktop(initial: DesktopStatus = { cli: readyCli(), server: { kind: 'idle' } }) {
  let status = initial;
  let refreshStatus: DesktopStatus | undefined;
  const port: CliUpdateDesktopPort = {
    status: vi.fn(() => status),
    stopServer: vi.fn(() => {
      status = { ...status, server: { kind: 'idle' } };
      return status;
    }),
    startServer: vi.fn(async () => {
      status = { ...status, server: { kind: 'connected', origin: 'http://127.0.0.1:58627' } };
      return status;
    }),
    refreshCli: vi.fn(async () => {
      if (refreshStatus !== undefined) status = refreshStatus;
      return status;
    }),
    refreshCapabilities: vi.fn(async () => undefined),
  };
  return {
    port,
    setStatus(next: DesktopStatus) { status = next; },
    setRefreshStatus(next: DesktopStatus) { refreshStatus = next; },
  };
}

function createService(overrides: Partial<ConstructorParameters<typeof CliUpdateService>[0]> = {}) {
  const desktopFixture = desktop();
  const updateCache = cache();
  const processRunner = { run: vi.fn(async () => ({ code: 0, output: 'updated', timedOut: false })) };
  const service = new CliUpdateService({
    cache: updateCache,
    desktop: desktopFixture.port,
    fetchLatest: vi.fn(async () => ({ latest: '0.31.0', manifest: null })),
    detectSource: vi.fn(async () => 'npm-global' as const),
    processRunner,
    now: () => new Date('2026-07-30T12:00:00.000Z'),
    platform: 'win32',
    ...overrides,
  });
  return { service, desktopFixture, updateCache, processRunner };
}

describe('CliUpdateService checks', () => {
  it('uses a fresh cache without fetching', async () => {
    const fetchLatest = vi.fn(async () => ({ latest: '0.31.0', manifest: null }));
    const { service } = createService({
      cache: cache({ checkedAt: '2026-07-30T11:00:00.000Z', latest: '0.30.0' }),
      fetchLatest,
    });

    await expect(service.check(readyCli())).resolves.toMatchObject({
      phase: 'current',
      currentVersion: '0.30.0',
      latestVersion: '0.30.0',
      updateAvailable: false,
    });
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it('forces a network refresh and exposes a supported update', async () => {
    const fetchLatest = vi.fn(async () => ({ latest: '0.31.0', manifest: null }));
    const detectSource = vi.fn(async () => 'npm-global' as const);
    const { service } = createService({ fetchLatest, detectSource });

    await expect(service.check(readyCli(), true)).resolves.toMatchObject({
      phase: 'available',
      latestVersion: '0.31.0',
      installSource: 'npm-global',
      canAutoInstall: true,
      installCommand: 'npm install --global @moonshot-ai/kimi-code@0.31.0',
    });
    expect(fetchLatest).toHaveBeenCalledOnce();
  });

  it('hides a rollout that is not eligible yet', async () => {
    const { service } = createService({
      fetchLatest: vi.fn(async () => ({
        latest: '0.31.0',
        manifest: {
          version: '0.31.0',
          publishedAt: '2026-07-30T12:00:00.000Z',
          rollout: [{ percent: 100, delaySeconds: 3600 }],
        },
      })),
    });

    await expect(service.check(readyCli(), true)).resolves.toMatchObject({
      phase: 'current',
      updateAvailable: false,
      latestVersion: '0.30.0',
    });
  });

  it('keeps an available update but disables one-click install for unsupported sources', async () => {
    const { service } = createService({ detectSource: vi.fn(async () => 'unsupported' as const) });

    await expect(service.check(readyCli(), true)).resolves.toMatchObject({
      phase: 'available',
      installSource: 'unsupported',
      canAutoInstall: false,
      installCommand: 'kimi upgrade',
      updateAvailable: true,
    });
  });

  it('retains the last good cached result when refresh fails', async () => {
    const { service } = createService({
      cache: cache({ checkedAt: '2026-07-28T00:00:00.000Z', latest: '0.31.0' }),
      fetchLatest: vi.fn(async () => { throw new Error('offline'); }),
    });

    await expect(service.check(readyCli(), true)).resolves.toMatchObject({
      phase: 'available',
      latestVersion: '0.31.0',
      updateAvailable: true,
      error: '暂时无法检查 CLI 更新，正在使用上次检查结果。',
    });
  });
});

describe('CliUpdateService installation', () => {
  it('stops, installs, verifies, restarts and succeeds in order', async () => {
    const fixture = desktop({ cli: readyCli(), server: { kind: 'connected', origin: 'http://127.0.0.1:58627' } });
    const processRunner = { run: vi.fn(async () => ({ code: 0, output: 'updated', timedOut: false })) };
    const service = new CliUpdateService({
      cache: cache(),
      desktop: fixture.port,
      fetchLatest: vi.fn(async () => ({ latest: '0.31.0', manifest: null })),
      detectSource: vi.fn(async () => 'npm-global' as const),
      processRunner,
      now: () => new Date('2026-07-30T12:00:00.000Z'),
      platform: 'win32',
    });
    const phases: string[] = [];
    service.onSnapshot((snapshot) => phases.push(snapshot.phase));
    await service.check(readyCli(), true);
    fixture.setRefreshStatus({ cli: readyCli('0.31.0'), server: { kind: 'idle' } });

    await expect(service.install()).resolves.toMatchObject({ phase: 'succeeded', currentVersion: '0.31.0' });
    expect(phases).toEqual(expect.arrayContaining([
      'stopping-service',
      'installing',
      'verifying',
      'restarting-service',
      'succeeded',
    ]));
    expect(fixture.port.stopServer).toHaveBeenCalledOnce();
    expect(fixture.port.startServer).toHaveBeenCalledOnce();
  });

  it('does not restart a service that was not running', async () => {
    const { service, desktopFixture } = createService();
    await service.check(readyCli(), true);
    desktopFixture.setRefreshStatus({ cli: readyCli('0.31.0'), server: { kind: 'idle' } });

    await service.install();
    expect(desktopFixture.port.startServer).not.toHaveBeenCalled();
  });

  it('fails verification when the installed version is still below the target', async () => {
    const { service } = createService();
    await service.check(readyCli(), true);

    await expect(service.install()).resolves.toMatchObject({
      phase: 'failed',
      error: 'CLI 升级后版本校验失败。',
    });
  });

  it('restores a previously running service after a failed installation', async () => {
    const fixture = desktop({ cli: readyCli(), server: { kind: 'connected', origin: 'http://127.0.0.1:58627' } });
    const service = new CliUpdateService({
      cache: cache(),
      desktop: fixture.port,
      fetchLatest: vi.fn(async () => ({ latest: '0.31.0', manifest: null })),
      detectSource: vi.fn(async () => 'npm-global' as const),
      processRunner: { run: vi.fn(async () => ({ code: 1, output: 'install failed', timedOut: false })) },
      now: () => new Date('2026-07-30T12:00:00.000Z'),
      platform: 'win32',
    });
    await service.check(readyCli(), true);

    await expect(service.install()).resolves.toMatchObject({ phase: 'failed', detail: 'install failed' });
    expect(fixture.port.startServer).toHaveBeenCalledOnce();
  });

  it('rejects unowned targets and reuses a concurrent installation', async () => {
    const fixture = createService();
    await expect(fixture.service.install()).rejects.toThrow('没有可安装的 CLI 更新');

    await fixture.service.check(readyCli(), true);
    fixture.desktopFixture.setRefreshStatus({ cli: readyCli('0.31.0'), server: { kind: 'idle' } });
    let release!: () => void;
    fixture.processRunner.run.mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ code: 0, output: '', timedOut: false }); }),
    );
    const first = fixture.service.install();
    const second = fixture.service.install();
    expect(fixture.processRunner.run).toHaveBeenCalledOnce();
    release();
    await expect(first).resolves.toMatchObject({ phase: 'succeeded' });
    await expect(second).resolves.toMatchObject({ phase: 'succeeded' });
  });
});
