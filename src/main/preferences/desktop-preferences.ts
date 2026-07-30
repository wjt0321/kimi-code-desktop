import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import { ThemePreferenceSchema, type ThemePreference } from '../../shared/contracts';

const DesktopPreferencesSchema = z.object({
  theme: ThemePreferenceSchema.default('system'),
});

type DesktopPreferences = z.infer<typeof DesktopPreferencesSchema>;

export interface DesktopPreferencesStore {
  read(): Promise<DesktopPreferences>;
  write(patch: { theme?: ThemePreference }): Promise<DesktopPreferences>;
}

export function createDesktopPreferencesStore(filePath: string): DesktopPreferencesStore {
  const fallback: DesktopPreferences = { theme: 'system' };

  const read = async (): Promise<DesktopPreferences> => {
    try {
      return DesktopPreferencesSchema.parse(JSON.parse(await readFile(filePath, 'utf8')));
    } catch {
      return fallback;
    }
  };

  return {
    read,
    async write(patch) {
      const current = await read();
      const next = DesktopPreferencesSchema.parse({ theme: patch.theme ?? current.theme });
      await mkdir(dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, filePath);
      return next;
    },
  };
}
