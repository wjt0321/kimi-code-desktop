import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

import { createCommandInvocation } from '../cli/command-runner';
import type { ChildProcessFactory, ManagedChild } from './server-lifecycle';

export function createChildProcessFactory(): ChildProcessFactory {
  return {
    spawn(command, args) {
      const invocation = createCommandInvocation(command, args);
      const child = spawn(invocation.file, invocation.args, {
        shell: false,
        windowsHide: true,
        windowsVerbatimArguments: invocation.windowsVerbatimArguments,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (!child.stdout || !child.stderr) throw new Error('Kimi Code local service output is unavailable.');
      return new OwnedChildProcess(child);
    },
  };
}

class OwnedChildProcess implements ManagedChild {
  readonly stdout;
  readonly stderr;

  constructor(private readonly child: ChildProcess) {
    if (!child.stdout || !child.stderr) throw new Error('Kimi Code local service output is unavailable.');
    this.stdout = child.stdout;
    this.stderr = child.stderr;
  }

  once(event: 'error', listener: (error: Error) => void): void;
  once(event: 'exit', listener: (code: number | null) => void): void;
  once(event: 'error' | 'exit', listener: ((error: Error) => void) | ((code: number | null) => void)): void {
    this.child.once(event, listener as never);
  }

  kill(): boolean {
    if (process.platform !== 'win32' || !this.child.pid) return this.child.kill();

    const result = spawnSync('taskkill.exe', ['/pid', String(this.child.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return result.error ? this.child.kill() : result.status === 0;
  }
}
