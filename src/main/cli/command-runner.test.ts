import { describe, expect, it } from 'vitest';

import { createCommandInvocation } from './command-runner';

describe('createCommandInvocation', () => {
  it('uses cmd.exe with fixed arguments for a cmd launcher', () => {
    expect(createCommandInvocation('C:\\Users\\example\\npm\\kimi.cmd', ['--version'])).toEqual({
      file: process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', '""C:\\Users\\example\\npm\\kimi.cmd" "--version""'],
      windowsVerbatimArguments: true,
    });
  });

  it('runs an exe directly without a command shell', () => {
    expect(createCommandInvocation('C:\\tools\\kimi.exe', ['--version'])).toEqual({
      file: 'C:\\tools\\kimi.exe',
      args: ['--version'],
    });
  });
});
