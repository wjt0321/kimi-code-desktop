import {
  DesktopCapabilitySnapshotSchema,
  type DesktopCapabilities,
  type DesktopCapabilityKey,
  type DesktopCapabilitySnapshot,
  type DesktopCapabilityState,
} from '../../shared/contracts';
import { LocalServiceRequestError } from './server-lifecycle';

interface CapabilityServiceOptions {
  readonly desktopVersion: string;
  readonly request: (path: string, init?: RequestInit) => Promise<unknown>;
  readonly now?: () => Date;
}

type ProbeResult =
  | { readonly kind: 'ok'; readonly value: unknown }
  | { readonly kind: 'error'; readonly error: unknown };

export class KimiCapabilityService {
  #snapshot: DesktopCapabilitySnapshot;
  #listeners = new Set<(snapshot: DesktopCapabilitySnapshot) => void>();
  #cachedCliVersion: string | undefined;
  #inflight: Promise<DesktopCapabilitySnapshot> | undefined;
  #generation = 0;

  constructor(private readonly options: CapabilityServiceOptions) {
    this.#snapshot = idleSnapshot(options.desktopVersion);
  }

  snapshot(): DesktopCapabilitySnapshot {
    return this.#snapshot;
  }

  onSnapshot(listener: (snapshot: DesktopCapabilitySnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  reset(cliVersion?: string): DesktopCapabilitySnapshot {
    this.#generation += 1;
    this.#cachedCliVersion = undefined;
    this.#inflight = undefined;
    this.#setSnapshot(idleSnapshot(this.options.desktopVersion, cliVersion));
    return this.#snapshot;
  }

  async refresh(cliVersion: string, force = false): Promise<DesktopCapabilitySnapshot> {
    if (!force && this.#cachedCliVersion === cliVersion && this.#snapshot.phase === 'ready') {
      return this.#snapshot;
    }
    if (!force && this.#inflight !== undefined) return this.#inflight;

    const generation = ++this.#generation;
    this.#setSnapshot({
      phase: 'detecting',
      desktopVersion: this.options.desktopVersion,
      cliVersion,
      compatibilityMode: isCompatibilityMode(cliVersion),
      capabilities: unknownCapabilities(),
    });

    const run = this.#detect(cliVersion, generation);
    this.#inflight = run;
    try {
      return await run;
    } finally {
      if (this.#inflight === run) this.#inflight = undefined;
    }
  }

  observe(key: DesktopCapabilityKey, state: DesktopCapabilityState): void {
    if (this.#snapshot.capabilities[key] === state) return;
    this.#setSnapshot({
      ...this.#snapshot,
      capabilities: { ...this.#snapshot.capabilities, [key]: state },
    });
  }

  async #detect(cliVersion: string, generation: number): Promise<DesktopCapabilitySnapshot> {
    const [meta, config, userInfo] = await Promise.all([
      probe(() => this.options.request('/meta')),
      probe(() => this.options.request('/config')),
      probe(() => this.options.request('/oauth/userinfo?provider=managed%3Akimi-code')),
    ]);

    if (generation !== this.#generation) return this.#snapshot;

    const serverVersion = meta.kind === 'ok' ? readServerVersion(meta.value) : undefined;
    const effectiveVersion = serverVersion ?? cliVersion;
    const baselineState = versionState(effectiveVersion, '0.30.0');
    const nextState = versionState(effectiveVersion, '0.31.0');
    const configState = probeState(config);
    const userInfoState = probeState(userInfo);
    const configRecord = config.kind === 'ok' ? asRecord(config.value) : undefined;
    const secondaryModelState = configRecord && Object.hasOwn(configRecord, 'secondary_model')
      ? 'supported'
      : nextState;

    const snapshot = DesktopCapabilitySnapshotSchema.parse({
      phase: 'ready',
      desktopVersion: this.options.desktopVersion,
      cliVersion,
      serverVersion,
      checkedAt: (this.options.now?.() ?? new Date()).toISOString(),
      compatibilityMode: isCompatibilityMode(cliVersion),
      capabilities: {
        sessionRuntime: baselineState,
        sessionWarnings: baselineState,
        transcript: baselineState,
        config: configState,
        secondaryModel: secondaryModelState,
        managedUserInfo: userInfoState,
        promptProfile: nextState,
        nonBlockingTaskOutput: nextState,
      },
    });

    this.#cachedCliVersion = cliVersion;
    this.#setSnapshot(snapshot);
    return this.#snapshot;
  }

  #setSnapshot(snapshot: DesktopCapabilitySnapshot): void {
    this.#snapshot = DesktopCapabilitySnapshotSchema.parse(snapshot);
    for (const listener of this.#listeners) listener(this.#snapshot);
  }
}

export function unknownCapabilities(): DesktopCapabilities {
  return {
    sessionRuntime: 'unknown',
    sessionWarnings: 'unknown',
    transcript: 'unknown',
    config: 'unknown',
    secondaryModel: 'unknown',
    managedUserInfo: 'unknown',
    promptProfile: 'unknown',
    nonBlockingTaskOutput: 'unknown',
  };
}

function idleSnapshot(desktopVersion: string, cliVersion?: string): DesktopCapabilitySnapshot {
  return DesktopCapabilitySnapshotSchema.parse({
    phase: 'idle',
    desktopVersion,
    cliVersion,
    compatibilityMode: cliVersion === undefined ? false : isCompatibilityMode(cliVersion),
    capabilities: unknownCapabilities(),
  });
}

async function probe(operation: () => Promise<unknown>): Promise<ProbeResult> {
  try {
    return { kind: 'ok', value: await operation() };
  } catch (error) {
    return { kind: 'error', error };
  }
}

function probeState(result: ProbeResult): DesktopCapabilityState {
  if (result.kind === 'ok') return 'supported';
  return routeState(result.error);
}

function routeState(error: unknown): DesktopCapabilityState {
  if (error instanceof LocalServiceRequestError) {
    if (error.status === 404 || error.code === 40401) return 'unsupported';
    if (error.status === 401 || error.status === 403) return 'supported';
  }
  return 'unknown';
}

function versionState(version: string, minimum: string): DesktopCapabilityState {
  const actual = parseVersion(version);
  const required = parseVersion(minimum);
  if (!actual || !required) return 'unknown';
  return compareVersion(actual, required) >= 0 ? 'supported' : 'unsupported';
}

function isCompatibilityMode(version: string): boolean {
  return versionState(version, '0.31.0') !== 'supported';
}

function parseVersion(value: string): readonly [number, number, number] | undefined {
  const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersion(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  for (let index = 0; index < 3; index += 1) {
    const delta = left[index] - right[index];
    if (delta !== 0) return delta;
  }
  return 0;
}

function readServerVersion(value: unknown): string | undefined {
  const record = asRecord(value);
  return typeof record?.server_version === 'string' && record.server_version.length > 0
    ? record.server_version
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
