import { describe, expect, it } from 'vitest';

import { discoverKimiCli, validateKimiCli, type CommandRunner } from './cli-discovery';

interface Result {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

function ok(stdout: string): Result {
  return { code: 0, stdout, stderr: '' };
}

function fail(code: number): Result {
  return { code, stdout: '', stderr: 'not found' };
}

function fakeRunner(responses: Record<string, Result>): CommandRunner {
  return {
    async run(file, args) {
      return responses[`${file} ${args.join(' ')}`] ?? fail(1);
    },
  };
}

describe('discoverKimiCli', () => {
  it('selects a cmd launcher from where.exe and returns its version', async () => {
    const runner = fakeRunner({
      'where.exe kimi': ok('C:\\Users\\example\\AppData\\Roaming\\npm\\kimi.cmd\r\n'),
      'C:\\Users\\example\\AppData\\Roaming\\npm\\kimi.cmd --version': ok('0.30.0\n'),
    });

    await expect(discoverKimiCli(runner)).resolves.toEqual({
      kind: 'ready',
      command: 'C:\\Users\\example\\AppData\\Roaming\\npm\\kimi.cmd',
      version: '0.30.0',
    });
  });

  it('normalizes an extensionless Windows npm shim returned by where.exe', async () => {
    const runner = fakeRunner({
      'where.exe kimi': ok('C:\\Users\\example\\AppData\\Roaming\\npm\\kimi\r\n'),
      'C:\\Users\\example\\AppData\\Roaming\\npm\\kimi.cmd --version': ok('0.30.0\n'),
    });

    await expect(discoverKimiCli(runner)).resolves.toEqual({
      kind: 'ready',
      command: 'C:\\Users\\example\\AppData\\Roaming\\npm\\kimi.cmd',
      version: '0.30.0',
    });
  });

  it('returns missing when where.exe finds no command', async () => {
    await expect(discoverKimiCli(fakeRunner({ 'where.exe kimi': fail(1) }))).resolves.toEqual({ kind: 'missing' });
  });

  it('returns invalid when a selected launcher cannot report its version', async () => {
    await expect(validateKimiCli('C:\\tools\\kimi.cmd', fakeRunner({ 'C:\\tools\\kimi.cmd --version': fail(1) }))).resolves.toEqual({
      kind: 'invalid',
      command: 'C:\\tools\\kimi.cmd',
      message: 'Unable to run Kimi Code CLI.',
    });
  });
});
