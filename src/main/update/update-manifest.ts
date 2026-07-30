import { z } from 'zod';

import { normalizeStableVersion } from './version';

export const KIMI_CLI_LATEST_MANIFEST_URL = 'https://code.kimi.com/kimi-code/latest.json';
export const KIMI_CLI_LATEST_TEXT_URL = 'https://code.kimi.com/kimi-code/latest';
export const CLI_UPDATE_FETCH_TIMEOUT_MS = 3_000;

const StableVersionSchema = z.string().transform((value, context) => {
  const normalized = normalizeStableVersion(value);
  if (normalized === null) {
    context.addIssue({ code: 'custom', message: 'invalid stable version' });
    return z.NEVER;
  }
  return normalized;
});

const RolloutBatchSchema = z.object({
  percent: z.number().int().min(0).max(100),
  delaySeconds: z.number().int().min(0),
});

export const UpdateManifestSchema = z.object({
  version: StableVersionSchema,
  publishedAt: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value)), { message: 'invalid timestamp' }),
  rollout: z.array(RolloutBatchSchema).readonly().default([]),
});

export type CliUpdateManifest = z.infer<typeof UpdateManifestSchema>;

export interface LatestCliRelease {
  readonly latest: string;
  readonly manifest: CliUpdateManifest | null;
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLI_UPDATE_FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchManifest(fetchImpl: typeof fetch): Promise<CliUpdateManifest> {
  const response = await fetchWithTimeout(fetchImpl, KIMI_CLI_LATEST_MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`latest.json returned HTTP ${response.status}`);
  }
  return UpdateManifestSchema.parse(JSON.parse(await response.text()));
}

async function fetchLatestText(fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchWithTimeout(fetchImpl, KIMI_CLI_LATEST_TEXT_URL);
  if (!response.ok) {
    throw new Error(`latest returned HTTP ${response.status}`);
  }
  const normalized = normalizeStableVersion(await response.text());
  if (normalized === null) {
    throw new Error('latest returned invalid stable version');
  }
  return normalized;
}

export async function fetchLatestCliRelease(
  fetchImpl: typeof fetch = fetch,
): Promise<LatestCliRelease> {
  const manifest = await fetchManifest(fetchImpl).catch(() => null);
  if (manifest !== null) {
    return { latest: manifest.version, manifest };
  }
  return { latest: await fetchLatestText(fetchImpl), manifest: null };
}
