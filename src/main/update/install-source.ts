import { dirname, join } from 'node:path';

import type { CliInstallSource } from '../../shared/contracts';
import { createCommandRunner, type CommandRunner } from '../cli/command-runner';

import { KIMI_CLI_NPM_PACKAGE } from './install-command';

export interface DetectInstallSourceInput {
  readonly cliCommand: string;
  readonly packageRoot?: string;
  readonly npmGlobalPrefix?: string;
  readonly platform: NodeJS.Platform;
}

function normalize(filePath: string, platform: NodeJS.Platform): string {
  const normalized = filePath.trim().replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function packageManagerHint(filePath: string): CliInstallSource | null {
  const normalized = filePath.replaceAll('\\', '/').toLowerCase();
  if (normalized.includes('/pnpm/global/') || normalized.includes('/pnpm/')) return 'pnpm-global';
  if (
    normalized.includes('/.config/yarn/global/') ||
    normalized.includes('/.yarn/global/') ||
    normalized.includes('/yarn/config/global/')
  ) {
    return 'yarn-global';
  }
  if (normalized.includes('/.bun/install/global/') || normalized.includes('/.bun/bin/')) {
    return 'bun-global';
  }
  return null;
}

export function detectInstallSource(input: DetectInstallSourceInput): CliInstallSource {
  const packageRootHint = input.packageRoot && packageManagerHint(input.packageRoot);
  if (packageRootHint) return packageRootHint;

  const launcherHint = packageManagerHint(input.cliCommand);
  if (launcherHint) return launcherHint;

  if (input.npmGlobalPrefix) {
    const prefix = normalize(input.npmGlobalPrefix, input.platform);
    const launcherDirectory = normalize(dirname(input.cliCommand), input.platform);
    const expectedPackageRoot = normalize(
      join(input.npmGlobalPrefix, 'node_modules', KIMI_CLI_NPM_PACKAGE),
      input.platform,
    );
    const packageRoot = input.packageRoot
      ? normalize(input.packageRoot, input.platform)
      : undefined;
    if (launcherDirectory === prefix || packageRoot === expectedPackageRoot) {
      return 'npm-global';
    }
  }

  return 'unsupported';
}

export interface DiscoverInstallSourceOptions {
  readonly cliCommand: string;
  readonly runner?: CommandRunner;
  readonly platform?: NodeJS.Platform;
}

export async function discoverInstallSource(
  options: DiscoverInstallSourceOptions,
): Promise<CliInstallSource> {
  const platform = options.platform ?? process.platform;
  const runner = options.runner ?? createCommandRunner();
  const npmExecutable = platform === 'win32' ? 'npm.cmd' : 'npm';
  let npmGlobalPrefix: string | undefined;
  try {
    const result = await runner.run(npmExecutable, ['prefix', '--global']);
    if (result.code === 0 && result.stdout.trim()) {
      npmGlobalPrefix = result.stdout.trim();
    }
  } catch {
    // Path hints below can still identify pnpm, yarn or bun installations.
  }

  return detectInstallSource({
    cliCommand: options.cliCommand,
    npmGlobalPrefix,
    platform,
  });
}
