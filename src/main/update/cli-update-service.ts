import type {
  CliDiscovery,
  CliInstallSource,
  DesktopCapabilitySnapshot,
  DesktopCliUpdateSnapshot,
  DesktopStatus,
} from '../../shared/contracts';
import type { InstallCommand } from './install-command';
import { resolveInstallCommand } from './install-command';
import type { CliUpdateCache, CliUpdateCachePatch } from './update-cache';
import { isCliUpdateCacheFresh } from './update-cache';
import type { LatestCliRelease } from './update-manifest';
import { isRolloutEligible } from './update-rollout';
import type { UpdateProcessRunner } from './update-process';
import { compareStableVersions, normalizeStableVersion } from './version';

export interface CliUpdateCachePort {
  read(): Promise<CliUpdateCache>;
  write(patch: CliUpdateCachePatch): Promise<CliUpdateCache>;
}

export interface CliUpdateDesktopPort {
  status(): DesktopStatus;
  stopServer(): DesktopStatus;
  startServer(): Promise<DesktopStatus>;
  refreshCli(): Promise<DesktopStatus>;
  refreshCapabilities(): Promise<DesktopCapabilitySnapshot | undefined>;
}

export interface CliUpdateServiceOptions {
  readonly cache: CliUpdateCachePort;
  readonly desktop: CliUpdateDesktopPort;
  readonly fetchLatest: () => Promise<LatestCliRelease>;
  readonly detectSource: (cliCommand: string) => Promise<CliInstallSource>;
  readonly processRunner: UpdateProcessRunner;
  readonly now?: () => Date;
  readonly platform?: NodeJS.Platform;
}

interface OwnedUpdateTarget {
  readonly version: string;
  readonly source: CliInstallSource;
  readonly command: InstallCommand;
}

const INITIAL_SNAPSHOT: DesktopCliUpdateSnapshot = {
  phase: 'idle',
  canAutoInstall: false,
  updateAvailable: false,
};

function serverIsActive(status: DesktopStatus['server']): boolean {
  return status.kind === 'starting' || status.kind === 'connected';
}

function readyCliFrom(status: DesktopStatus): Extract<CliDiscovery, { kind: 'ready' }> | null {
  return status.cli.kind === 'ready' ? status.cli : null;
}

export class CliUpdateService {
  #snapshot: DesktopCliUpdateSnapshot = INITIAL_SNAPSHOT;
  #listeners = new Set<(snapshot: DesktopCliUpdateSnapshot) => void>();
  #target: OwnedUpdateTarget | undefined;
  #installPromise: Promise<DesktopCliUpdateSnapshot> | undefined;

  constructor(private readonly options: CliUpdateServiceOptions) {}

  snapshot(): DesktopCliUpdateSnapshot {
    return this.#snapshot;
  }

  onSnapshot(listener: (snapshot: DesktopCliUpdateSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async check(
    currentCli: Extract<CliDiscovery, { kind: 'ready' }>,
    force = false,
  ): Promise<DesktopCliUpdateSnapshot> {
    const currentVersion = normalizeStableVersion(currentCli.version);
    if (currentVersion === null) {
      return this.#setSnapshot({
        phase: 'failed',
        currentVersion: currentCli.version,
        canAutoInstall: false,
        updateAvailable: false,
        error: '无法识别当前 CLI 版本。',
      });
    }

    this.#target = undefined;
    this.#setSnapshot({
      phase: 'checking',
      currentVersion,
      canAutoInstall: false,
      updateAvailable: false,
    });

    const now = this.options.now?.() ?? new Date();
    let cached = await this.options.cache.read();
    let refreshError = false;
    if (force || !isCliUpdateCacheFresh(cached, now)) {
      try {
        const release = await this.options.fetchLatest();
        cached = await this.options.cache.write({
          checkedAt: now.toISOString(),
          latest: release.latest,
          manifest: release.manifest,
        });
      } catch {
        refreshError = true;
      }
    }

    const latestVersion = cached.latest && normalizeStableVersion(cached.latest);
    if (latestVersion === null) {
      return this.#setSnapshot({
        phase: refreshError ? 'failed' : 'current',
        currentVersion,
        checkedAt: cached.checkedAt ?? undefined,
        canAutoInstall: false,
        updateAvailable: false,
        error: refreshError ? '暂时无法检查 CLI 更新。' : undefined,
      });
    }

    const rolloutEligible =
      cached.manifest === null || isRolloutEligible(cached.manifest, cached.deviceId, now);
    const newerVersionExists = compareStableVersions(currentVersion, latestVersion) < 0;
    const updateAvailable = newerVersionExists && rolloutEligible;
    if (!updateAvailable) {
      return this.#setSnapshot({
        phase: 'current',
        currentVersion,
        latestVersion: newerVersionExists ? currentVersion : latestVersion,
        checkedAt: cached.checkedAt ?? undefined,
        canAutoInstall: false,
        updateAvailable: false,
        error: refreshError ? '暂时无法检查 CLI 更新，正在使用上次检查结果。' : undefined,
      });
    }

    const source = await this.options.detectSource(currentCli.command).catch(() => 'unsupported' as const);
    const command = resolveInstallCommand(
      source,
      latestVersion,
      this.options.platform ?? process.platform,
    );
    if (command !== undefined) {
      this.#target = { version: latestVersion, source, command };
    }

    return this.#setSnapshot({
      phase: 'available',
      currentVersion,
      latestVersion,
      checkedAt: cached.checkedAt ?? undefined,
      installSource: source,
      installCommand: command?.display ?? 'kimi upgrade',
      canAutoInstall: command !== undefined,
      updateAvailable: true,
      error: refreshError ? '暂时无法检查 CLI 更新，正在使用上次检查结果。' : undefined,
    });
  }

  install(): Promise<DesktopCliUpdateSnapshot> {
    if (this.#installPromise !== undefined) return this.#installPromise;
    if (this.#target === undefined) {
      return Promise.reject(new Error('没有可安装的 CLI 更新。'));
    }
    const operation = this.#runInstall(this.#target).finally(() => {
      if (this.#installPromise === operation) this.#installPromise = undefined;
    });
    this.#installPromise = operation;
    return operation;
  }

  async #runInstall(target: OwnedUpdateTarget): Promise<DesktopCliUpdateSnapshot> {
    const statusBeforeInstall = this.options.desktop.status();
    const shouldRestartService = serverIsActive(statusBeforeInstall.server);
    this.#setSnapshot({ ...this.#snapshot, phase: 'stopping-service', error: undefined });
    if (shouldRestartService) this.options.desktop.stopServer();

    this.#setSnapshot({ ...this.#snapshot, phase: 'installing' });
    const result = await this.options.processRunner.run(target.command);
    if (result.code !== 0) {
      await this.#restoreServiceAfterFailure(shouldRestartService);
      return this.#setSnapshot({
        ...this.#snapshot,
        phase: 'failed',
        error: result.timedOut ? 'CLI 升级超时。' : 'CLI 升级失败。',
        detail: result.output || undefined,
      });
    }

    this.#setSnapshot({ ...this.#snapshot, phase: 'verifying', detail: result.output || undefined });
    const refreshed = await this.options.desktop.refreshCli();
    const verifiedCli = readyCliFrom(refreshed);
    const verifiedVersion = verifiedCli && normalizeStableVersion(verifiedCli.version);
    if (verifiedVersion === null || compareStableVersions(verifiedVersion, target.version) < 0) {
      await this.#restoreServiceAfterFailure(shouldRestartService);
      return this.#setSnapshot({
        ...this.#snapshot,
        phase: 'failed',
        currentVersion: verifiedVersion ?? this.#snapshot.currentVersion,
        error: 'CLI 升级后版本校验失败。',
      });
    }

    if (shouldRestartService) {
      this.#setSnapshot({ ...this.#snapshot, phase: 'restarting-service', currentVersion: verifiedVersion });
      try {
        await this.options.desktop.startServer();
        await this.options.desktop.refreshCapabilities();
      } catch {
        return this.#setSnapshot({
          ...this.#snapshot,
          phase: 'failed',
          currentVersion: verifiedVersion,
          error: 'CLI 已升级，但本地服务重新启动失败。',
        });
      }
    }

    this.#target = undefined;
    return this.#setSnapshot({
      ...this.#snapshot,
      phase: 'succeeded',
      currentVersion: verifiedVersion,
      canAutoInstall: false,
      updateAvailable: false,
      error: undefined,
    });
  }

  async #restoreServiceAfterFailure(shouldRestartService: boolean): Promise<void> {
    const refreshed = await this.options.desktop.refreshCli().catch(() => null);
    if (!shouldRestartService || refreshed === null || readyCliFrom(refreshed) === null) return;
    this.#setSnapshot({ ...this.#snapshot, phase: 'restarting-service' });
    await this.options.desktop.startServer().catch(() => undefined);
    await this.options.desktop.refreshCapabilities().catch(() => undefined);
  }

  #setSnapshot(snapshot: DesktopCliUpdateSnapshot): DesktopCliUpdateSnapshot {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener(snapshot);
    return snapshot;
  }
}
