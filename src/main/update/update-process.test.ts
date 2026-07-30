import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InstallCommand } from './install-command';
import { createUpdateProcessRunner, redactUpdateOutput } from './update-process';

const command: InstallCommand = {
  executable: 'npm.cmd',
  args: ['install', '--global', '@moonshot-ai/kimi-code@0.31.0'],
  display: 'npm install --global @moonshot-ai/kimi-code@0.31.0',
};

function fakeChild() {
  const events = new EventEmitter();
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  return {
    stdout,
    stderr,
    kill: vi.fn(() => true),
    once: events.once.bind(events),
    close(code: number) {
      events.emit('close', code);
    },
    fail(error: Error) {
      events.emit('error', error);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('update process runner', () => {
  it('runs only the fixed descriptor with a hidden shell-free process', async () => {
    const child = fakeChild();
    const spawnImpl = vi.fn(() => child);
    const runner = createUpdateProcessRunner({ spawnImpl });

    const pending = runner.run(command);
    child.close(0);

    await expect(pending).resolves.toEqual({ code: 0, output: '', timedOut: false });
    expect(spawnImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }),
    );
  });

  it('combines output, retains only the tail and redacts credentials', async () => {
    const child = fakeChild();
    const runner = createUpdateProcessRunner({ spawnImpl: () => child, maxOutputChars: 120 });
    const pending = runner.run(command);

    child.stdout.emit('data', Buffer.from(`old-${'x'.repeat(180)}\n`));
    child.stderr.emit('data', Buffer.from('Authorization: Bearer super-secret-token\nNPM_TOKEN=also-secret\nfinished\n'));
    child.close(0);

    const result = await pending;
    expect(result.code).toBe(0);
    expect(result.output.length).toBeLessThanOrEqual(120);
    expect(result.output).toContain('finished');
    expect(result.output).not.toContain('super-secret-token');
    expect(result.output).not.toContain('also-secret');
    expect(result.output).toContain('[已隐藏]');
  });

  it('returns a controlled timeout and stops the child', async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const runner = createUpdateProcessRunner({ spawnImpl: () => child, timeoutMs: 1_000 });
    const pending = runner.run(command);

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toMatchObject({ code: 1, timedOut: true });
    expect(child.kill).toHaveBeenCalledOnce();
  });

  it('does not expose process errors or environment values', async () => {
    const child = fakeChild();
    const runner = createUpdateProcessRunner({ spawnImpl: () => child });
    const pending = runner.run(command);
    child.fail(new Error(`spawn failed with ${process.env.PATH}`));

    const result = await pending;
    expect(result).toEqual({ code: 1, output: '无法启动 CLI 升级进程。', timedOut: false });
    expect(result.output).not.toContain(process.env.PATH ?? 'not-present');
  });
});

describe('redactUpdateOutput', () => {
  it('redacts registry tokens, assignments and URL credentials', () => {
    expect(
      redactUpdateOutput(
        '//registry.npmjs.org/:_authToken=abc123\nPASSWORD=hunter2\nhttps://user:pass@example.test/pkg',
      ),
    ).toBe('//registry.npmjs.org/:_authToken=[已隐藏]\nPASSWORD=[已隐藏]\nhttps://[已隐藏]@example.test/pkg');
  });
});

