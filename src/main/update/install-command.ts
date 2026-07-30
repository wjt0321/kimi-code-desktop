import type { CliInstallSource } from '../../shared/contracts';

import { normalizeStableVersion } from './version';

export const KIMI_CLI_NPM_PACKAGE = '@moonshot-ai/kimi-code';

export interface InstallCommand {
  readonly executable: string;
  readonly args: readonly string[];
  readonly display: string;
}

interface CommandTemplate {
  readonly executable: string;
  readonly args: (packageSpec: string) => readonly string[];
}

const TEMPLATES: Partial<Record<CliInstallSource, CommandTemplate>> = {
  'npm-global': {
    executable: 'npm',
    args: (packageSpec) => ['install', '--global', packageSpec],
  },
  'pnpm-global': {
    executable: 'pnpm',
    args: (packageSpec) => ['add', '--global', packageSpec],
  },
  'yarn-global': {
    executable: 'yarn',
    args: (packageSpec) => ['global', 'add', packageSpec],
  },
  'bun-global': {
    executable: 'bun',
    args: (packageSpec) => ['add', '--global', packageSpec],
  },
};

export function resolveInstallCommand(
  source: CliInstallSource,
  version: string,
  platform: NodeJS.Platform = process.platform,
): InstallCommand | undefined {
  const normalizedVersion = normalizeStableVersion(version);
  const template = TEMPLATES[source];
  if (normalizedVersion === null || template === undefined) return undefined;

  const packageSpec = `${KIMI_CLI_NPM_PACKAGE}@${normalizedVersion}`;
  const args = template.args(packageSpec);
  const executable =
    platform === 'win32'
      ? template.executable === 'bun'
        ? 'bun.exe'
        : `${template.executable}.cmd`
      : template.executable;

  return {
    executable,
    args,
    display: [template.executable, ...args].join(' '),
  };
}
