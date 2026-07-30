import { extname } from 'node:path';

import type { CliDiscovery } from '../../shared/contracts';
import { createCommandRunner, type CommandRunner } from './command-runner';

export type { CommandRunner } from './command-runner';

const launcherPattern = /\.(?:cmd|bat|exe)$/i;

export async function discoverKimiCli(runner: CommandRunner = createCommandRunner()): Promise<CliDiscovery> {
  const result = await runner.run('where.exe', ['kimi']);
  if (result.code !== 0) return { kind: 'missing' };

  for (const command of result.stdout.split(/\r?\n/).map((line) => line.trim()).flatMap(launcherCandidates)) {
    const cli = await validateKimiCli(command, runner);
    if (cli.kind === 'ready') return cli;
  }

  return { kind: 'missing' };
}

export async function validateKimiCli(command: string, runner: CommandRunner = createCommandRunner()): Promise<CliDiscovery> {
  try {
    const result = await runner.run(command, ['--version']);
    const version = result.stdout.trim().split(/\s+/)[0];
    if (result.code === 0 && version) return { kind: 'ready', command, version };
  } catch {
    // The public status below deliberately avoids leaking raw process diagnostics.
  }

  return { kind: 'invalid', command, message: 'Unable to run Kimi Code CLI.' };
}

function launcherCandidates(command: string): string[] {
  if (launcherPattern.test(command)) return [command];
  if (extname(command) === '') return [`${command}.cmd`, `${command}.exe`];
  return [];
}
