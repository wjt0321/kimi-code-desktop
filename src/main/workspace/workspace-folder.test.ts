import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createWorkspaceFolder, validateWorkspaceFolderName } from './workspace-folder';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('workspace folder', () => {
  it.each(['', '   ', '.', '..', 'CON', 'nul', 'COM1', 'name.', 'a/b', 'a\\b'])('rejects unsafe Windows name %j', (name) => {
    expect(() => validateWorkspaceFolderName(name)).toThrow();
  });

  it('accepts a trimmed Chinese workspace name', () => {
    expect(validateWorkspaceFolderName('  桌面项目  ')).toBe('桌面项目');
  });

  it('creates exactly one child directory and refuses an existing target', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'kimi-desktop-workspace-'));
    roots.push(parent);
    const created = await createWorkspaceFolder(parent, '新项目');
    expect(created).toBe(join(parent, '新项目'));
    await expect(createWorkspaceFolder(parent, '新项目')).rejects.toThrow('已经存在');
    await writeFile(join(parent, 'occupied'), 'x');
    await expect(createWorkspaceFolder(parent, 'occupied')).rejects.toThrow('已经存在');
  });
});

