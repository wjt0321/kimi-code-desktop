import { mkdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const WINDOWS_INVALID = /[<>:"/\\|?*\u0000-\u001F]/;

export function validateWorkspaceFolderName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error('请输入工作区名称。');
  if (name === '.' || name === '..' || WINDOWS_INVALID.test(name)) throw new Error('工作区名称包含 Windows 不允许的字符。');
  if (WINDOWS_RESERVED.test(name)) throw new Error('该名称是 Windows 保留名称，请换一个名称。');
  if (/[. ]$/.test(name)) throw new Error('工作区名称不能以空格或句点结尾。');
  if (name.length > 120) throw new Error('工作区名称不能超过 120 个字符。');
  return name;
}

export async function createWorkspaceFolder(parent: string, value: string): Promise<string> {
  const name = validateWorkspaceFolderName(value);
  const resolvedParent = resolve(parent);
  const target = resolve(join(resolvedParent, name));
  if (dirname(target) !== resolvedParent || basename(target) !== name) throw new Error('工作区目录必须创建在所选父文件夹中。');
  try {
    await mkdir(target, { recursive: false });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') throw new Error('同名文件或文件夹已经存在。');
    throw error;
  }
  return target;
}

