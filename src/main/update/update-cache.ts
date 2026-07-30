import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import { UpdateManifestSchema, type CliUpdateManifest } from './update-manifest';
import { normalizeStableVersion } from './version';

export const CLI_UPDATE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const CliUpdateCacheSchema = z.object({
  deviceId: z.string().uuid(),
  checkedAt: z.string().nullable(),
  latest: z.string().nullable(),
  manifest: UpdateManifestSchema.nullable(),
});

export interface CliUpdateCache {
  readonly deviceId: string;
  readonly checkedAt: string | null;
  readonly latest: string | null;
  readonly manifest: CliUpdateManifest | null;
}

export interface CliUpdateCachePatch {
  readonly checkedAt: string | null;
  readonly latest: string | null;
  readonly manifest: CliUpdateManifest | null;
}

async function atomicWrite(filePath: string, value: CliUpdateCache): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

function emptyCache(): CliUpdateCache {
  return {
    deviceId: randomUUID(),
    checkedAt: null,
    latest: null,
    manifest: null,
  };
}

function sanitizeCache(value: unknown): CliUpdateCache | null {
  const parsed = CliUpdateCacheSchema.safeParse(value);
  if (!parsed.success) return null;
  const latest = parsed.data.latest === null ? null : normalizeStableVersion(parsed.data.latest);
  if (parsed.data.latest !== null && latest === null) return null;
  const checkedAt = parsed.data.checkedAt;
  if (checkedAt !== null && !Number.isFinite(Date.parse(checkedAt))) return null;
  return { ...parsed.data, latest };
}

export function createCliUpdateCacheStore(filePath: string): {
  read(): Promise<CliUpdateCache>;
  write(patch: CliUpdateCachePatch): Promise<CliUpdateCache>;
} {
  let inMemory: CliUpdateCache | null = null;

  async function read(): Promise<CliUpdateCache> {
    if (inMemory !== null) return inMemory;
    try {
      const parsed = sanitizeCache(JSON.parse(await readFile(filePath, 'utf8')));
      if (parsed !== null) {
        inMemory = parsed;
        return parsed;
      }
    } catch {
      // Recreate missing or malformed caches below.
    }
    inMemory = emptyCache();
    await atomicWrite(filePath, inMemory);
    return inMemory;
  }

  return {
    read,
    async write(patch) {
      const current = await read();
      const next = CliUpdateCacheSchema.parse({ ...current, ...patch });
      inMemory = next;
      await atomicWrite(filePath, next);
      return next;
    },
  };
}

export function isCliUpdateCacheFresh(
  cache: Pick<CliUpdateCache, 'checkedAt'>,
  now: Date,
): boolean {
  if (cache.checkedAt === null) return false;
  const checkedAt = Date.parse(cache.checkedAt);
  if (!Number.isFinite(checkedAt)) return false;
  const age = now.getTime() - checkedAt;
  return age >= 0 && age <= CLI_UPDATE_CACHE_MAX_AGE_MS;
}
