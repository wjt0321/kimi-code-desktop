import { describe, expect, it } from 'vitest';

import { KIMI_CLI_NPM_PACKAGE, resolveInstallCommand } from './install-command';

describe('resolveInstallCommand', () => {
  it.each([
    [
      'npm-global',
      'npm.cmd',
      ['install', '--global', `${KIMI_CLI_NPM_PACKAGE}@0.31.0`],
      `npm install --global ${KIMI_CLI_NPM_PACKAGE}@0.31.0`,
    ],
    [
      'pnpm-global',
      'pnpm.cmd',
      ['add', '--global', `${KIMI_CLI_NPM_PACKAGE}@0.31.0`],
      `pnpm add --global ${KIMI_CLI_NPM_PACKAGE}@0.31.0`,
    ],
    [
      'yarn-global',
      'yarn.cmd',
      ['global', 'add', `${KIMI_CLI_NPM_PACKAGE}@0.31.0`],
      `yarn global add ${KIMI_CLI_NPM_PACKAGE}@0.31.0`,
    ],
    [
      'bun-global',
      'bun.exe',
      ['add', '--global', `${KIMI_CLI_NPM_PACKAGE}@0.31.0`],
      `bun add --global ${KIMI_CLI_NPM_PACKAGE}@0.31.0`,
    ],
  ] as const)('builds a fixed %s command', (source, executable, args, display) => {
    expect(resolveInstallCommand(source, 'v0.31.0', 'win32')).toEqual({
      executable,
      args,
      display,
    });
  });

  it('uses extensionless executables outside Windows', () => {
    expect(resolveInstallCommand('npm-global', '0.31.0', 'linux')?.executable).toBe('npm');
  });

  it('rejects unsupported sources and non-stable versions', () => {
    expect(resolveInstallCommand('unsupported', '0.31.0', 'win32')).toBeUndefined();
    expect(resolveInstallCommand('native', '0.31.0', 'win32')).toBeUndefined();
    expect(resolveInstallCommand('npm-global', '0.31.0-beta.1', 'win32')).toBeUndefined();
  });
});
