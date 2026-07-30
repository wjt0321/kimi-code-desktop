import { spawn } from 'node:child_process';
import type { EventEmitter } from 'node:events';

import { createCommandInvocation } from '../cli/command-runner';
import type { InstallCommand } from './install-command';

export const DEFAULT_UPDATE_TIMEOUT_MS = 10 * 60 * 1000;
export const DEFAULT_UPDATE_OUTPUT_CHARS = 16_000;

interface UpdateProcessChild {
  readonly stdout: Pick<EventEmitter, 'on'>;
  readonly stderr: Pick<EventEmitter, 'on'>;
  once(event: 'error', listener: (error: Error) => void): unknown;
  once(event: 'close', listener: (code: number | null) => void): unknown;
  kill(): boolean;
}

interface SpawnOptions {
  readonly shell: false;
  readonly windowsHide: true;
  readonly windowsVerbatimArguments?: boolean;
  readonly stdio: ['ignore', 'pipe', 'pipe'];
}

type SpawnImpl = (
  executable: string,
  args: readonly string[],
  options: SpawnOptions,
) => UpdateProcessChild;

export interface UpdateProcessResult {
  readonly code: number;
  readonly output: string;
  readonly timedOut: boolean;
}

export interface UpdateProcessRunner {
  run(command: InstallCommand): Promise<UpdateProcessResult>;
}

export interface UpdateProcessRunnerOptions {
  readonly spawnImpl?: SpawnImpl;
  readonly timeoutMs?: number;
  readonly maxOutputChars?: number;
}

function appendTail(current: string, chunk: string, maximum: number): string {
  const next = current + chunk;
  return next.length <= maximum ? next : next.slice(-maximum);
}

export function redactUpdateOutput(value: string): string {
  return value
    .replace(/(authorization\s*:\s*(?:bearer\s+)?)[^\s]+/gi, '$1[已隐藏]')
    .replace(/(_authToken\s*=\s*)[^\s]+/gi, '$1[已隐藏]')
    .replace(/\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY)[A-Z0-9_]*\s*=\s*)[^\s]+/gi, '$1[已隐藏]')
    .replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, (match) => {
      const protocol = match.slice(0, match.indexOf('//') + 2);
      return `${protocol}[已隐藏]@`;
    });
}

export function createUpdateProcessRunner(
  options: UpdateProcessRunnerOptions = {},
): UpdateProcessRunner {
  const spawnImpl: SpawnImpl =
    options.spawnImpl ??
    ((executable, args, spawnOptions) =>
      spawn(executable, [...args], spawnOptions as unknown as Parameters<typeof spawn>[2]) as unknown as UpdateProcessChild);
  const timeoutMs = options.timeoutMs ?? DEFAULT_UPDATE_TIMEOUT_MS;
  const maxOutputChars = options.maxOutputChars ?? DEFAULT_UPDATE_OUTPUT_CHARS;

  return {
    run(command) {
      const invocation = createCommandInvocation(command.executable, command.args);
      return new Promise((resolve) => {
        let child: UpdateProcessChild;
        try {
          child = spawnImpl(invocation.file, invocation.args, {
            shell: false,
            windowsHide: true,
            windowsVerbatimArguments: invocation.windowsVerbatimArguments,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
        } catch {
          resolve({ code: 1, output: '无法启动 CLI 升级进程。', timedOut: false });
          return;
        }

        let settled = false;
        let rawOutput = '';
        const rawTailLimit = Math.max(maxOutputChars * 4, maxOutputChars);
        const capture = (chunk: unknown) => {
          rawOutput = appendTail(rawOutput, String(chunk), rawTailLimit);
        };
        child.stdout.on('data', capture);
        child.stderr.on('data', capture);

        const finish = (result: UpdateProcessResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(result);
        };
        const safeOutput = () => redactUpdateOutput(rawOutput).slice(-maxOutputChars).trim();
        const timeout = setTimeout(() => {
          child.kill();
          const output = safeOutput();
          finish({
            code: 1,
            output: output ? `${output}\n升级进程超时。` : '升级进程超时。',
            timedOut: true,
          });
        }, timeoutMs);

        child.once('error', () => {
          finish({ code: 1, output: '无法启动 CLI 升级进程。', timedOut: false });
        });
        child.once('close', (code) => {
          finish({ code: code ?? 1, output: safeOutput(), timedOut: false });
        });
      });
    },
  };
}

