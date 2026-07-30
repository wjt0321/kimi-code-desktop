import { spawn } from 'node:child_process';
import { extname } from 'node:path';

export interface CommandResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CommandRunner {
  run(file: string, args: readonly string[]): Promise<CommandResult>;
}

interface Invocation {
  readonly file: string;
  readonly args: readonly string[];
  readonly windowsVerbatimArguments?: boolean;
}

export function createCommandRunner(): CommandRunner {
  return {
    run(file, args) {
      const invocation = createCommandInvocation(file, args);
      return new Promise((resolve, reject) => {
        const child = spawn(invocation.file, invocation.args, {
          shell: false,
          windowsHide: true,
          windowsVerbatimArguments: invocation.windowsVerbatimArguments,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => { stdout += chunk; });
        child.stderr.on('data', (chunk: string) => { stderr += chunk; });
        child.once('error', reject);
        child.once('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
      });
    },
  };
}

export function createCommandInvocation(file: string, args: readonly string[]): Invocation {
  const extension = extname(file).toLowerCase();
  if (extension !== '.cmd' && extension !== '.bat') return { file, args };

  const command = [quoteForCmd(file), ...args.map(quoteForCmd)].join(' ');
  return {
    file: process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d', '/s', '/c', `"${command}"`],
    windowsVerbatimArguments: true,
  };
}

function quoteForCmd(value: string): string {
  return `"${value.replace(/["^&|<>()%!]/g, '^$&')}"`;
}
