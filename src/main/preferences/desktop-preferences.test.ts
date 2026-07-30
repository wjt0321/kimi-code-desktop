import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDesktopPreferencesStore } from './desktop-preferences';

const dirs: string[] = [];

async function tempFile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'kimi-desktop-preferences-'));
  dirs.push(dir);
  return join(dir, 'nested', 'desktop-preferences.json');
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('desktop preferences store', () => {
  it('uses system theme for missing malformed and invalid files', async () => {
    const missing = await tempFile();
    await expect(createDesktopPreferencesStore(missing).read()).resolves.toEqual({ theme: 'system' });

    const malformed = await tempFile();
    await mkdir(join(malformed, '..'), { recursive: true });
    await writeFile(malformed, '{not-json', 'utf8');
    await expect(createDesktopPreferencesStore(malformed).read()).resolves.toEqual({ theme: 'system' });

    const invalid = await tempFile();
    await mkdir(join(invalid, '..'), { recursive: true });
    await writeFile(invalid, JSON.stringify({ theme: 'auto' }), 'utf8');
    await expect(createDesktopPreferencesStore(invalid).read()).resolves.toEqual({ theme: 'system' });
  });

  it('persists a validated theme preference and returns the new snapshot', async () => {
    const file = await tempFile();
    const store = createDesktopPreferencesStore(file);

    await expect(store.write({ theme: 'light' })).resolves.toEqual({ theme: 'light' });
    await expect(store.read()).resolves.toEqual({ theme: 'light' });
    await expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ theme: 'light' });
  });

  it('preserves the current value when a patch omits theme', async () => {
    const file = await tempFile();
    const store = createDesktopPreferencesStore(file);
    await store.write({ theme: 'dark' });

    await expect(store.write({})).resolves.toEqual({ theme: 'dark' });
  });
});
