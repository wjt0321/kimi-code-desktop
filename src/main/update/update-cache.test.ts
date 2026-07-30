import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCliUpdateCacheStore, isCliUpdateCacheFresh } from './update-cache';

const dirs: string[] = [];

async function tempFile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'kimi-desktop-update-cache-'));
  dirs.push(dir);
  return join(dir, 'nested', 'cli-update.json');
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('CLI update cache', () => {
  it('creates and preserves a stable device id', async () => {
    const file = await tempFile();
    const store = createCliUpdateCacheStore(file);
    const first = await store.read();
    const second = await store.read();

    expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second.deviceId).toBe(first.deviceId);
    expect(JSON.parse(await readFile(file, 'utf8')).deviceId).toBe(first.deviceId);
  });

  it('recovers from malformed cache files', async () => {
    const file = await tempFile();
    await writeFile(file, '{broken', 'utf8').catch(async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, '{broken', 'utf8');
    });

    await expect(createCliUpdateCacheStore(file).read()).resolves.toMatchObject({
      checkedAt: null,
      latest: null,
      manifest: null,
    });
  });

  it('persists release data without changing the device id', async () => {
    const file = await tempFile();
    const store = createCliUpdateCacheStore(file);
    const initial = await store.read();
    const saved = await store.write({
      checkedAt: '2026-07-30T12:00:00.000Z',
      latest: '0.31.0',
      manifest: null,
    });

    expect(saved.deviceId).toBe(initial.deviceId);
    expect(saved.latest).toBe('0.31.0');
  });

  it('treats checks as fresh for 24 hours', () => {
    expect(
      isCliUpdateCacheFresh(
        { checkedAt: '2026-07-30T00:00:00.000Z' },
        new Date('2026-07-30T23:59:59.999Z'),
      ),
    ).toBe(true);
    expect(
      isCliUpdateCacheFresh(
        { checkedAt: '2026-07-30T00:00:00.000Z' },
        new Date('2026-07-31T00:00:00.001Z'),
      ),
    ).toBe(false);
    expect(isCliUpdateCacheFresh({ checkedAt: null }, new Date())).toBe(false);
  });
});
