import { describe, expect, it } from 'vitest';

import { detectInstallSource, discoverInstallSource } from './install-source';

describe('detectInstallSource', () => {
  it('detects a Windows npm global launcher from its prefix', () => {
    expect(
      detectInstallSource({
        cliCommand: 'C:\\Users\\example user\\AppData\\Roaming\\npm\\kimi.cmd',
        packageRoot:
          'C:\\Users\\example user\\AppData\\Roaming\\npm\\node_modules\\@moonshot-ai\\kimi-code',
        npmGlobalPrefix: 'C:\\Users\\example user\\AppData\\Roaming\\npm',
        platform: 'win32',
      }),
    ).toBe('npm-global');
  });

  it.each([
    ['C:\\Users\\example\\AppData\\Local\\pnpm\\global\\5\\node_modules\\@moonshot-ai\\kimi-code', 'pnpm-global'],
    ['C:\\Users\\example\\AppData\\Local\\Yarn\\config\\global\\node_modules\\@moonshot-ai\\kimi-code', 'yarn-global'],
    ['C:\\Users\\example\\.bun\\install\\global\\node_modules\\@moonshot-ai\\kimi-code', 'bun-global'],
  ] as const)('detects %s as %s', (packageRoot, expected) => {
    expect(
      detectInstallSource({
        cliCommand: 'C:\\tools\\kimi.cmd',
        packageRoot,
        platform: 'win32',
      }),
    ).toBe(expected);
  });

  it('uses launcher path hints for package-manager shims', () => {
    expect(
      detectInstallSource({
        cliCommand: 'C:\\Users\\example\\AppData\\Local\\pnpm\\kimi.cmd',
        platform: 'win32',
      }),
    ).toBe('pnpm-global');
    expect(
      detectInstallSource({
        cliCommand: 'C:\\Users\\example\\.bun\\bin\\kimi.exe',
        platform: 'win32',
      }),
    ).toBe('bun-global');
  });

  it('does not guess an unknown portable executable', () => {
    expect(
      detectInstallSource({
        cliCommand: 'D:\\Portable Apps\\Kimi\\kimi.exe',
        platform: 'win32',
      }),
    ).toBe('unsupported');
  });

  it('discovers the npm prefix through an injected command runner', async () => {
    const calls: Array<{ file: string; args: readonly string[] }> = [];
    const source = await discoverInstallSource({
      cliCommand: 'C:\\Users\\example\\AppData\\Roaming\\npm\\kimi.cmd',
      platform: 'win32',
      runner: {
        async run(file, args) {
          calls.push({ file, args });
          return {
            code: 0,
            stdout: 'C:\\Users\\example\\AppData\\Roaming\\npm\r\n',
            stderr: '',
          };
        },
      },
    });

    expect(source).toBe('npm-global');
    expect(calls).toEqual([{ file: 'npm.cmd', args: ['prefix', '--global'] }]);
  });
});
