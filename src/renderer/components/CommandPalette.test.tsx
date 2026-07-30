import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopStatus } from '../../shared/contracts';
import { CommandPalette } from './CommandPalette';

const status: DesktopStatus = {
  cli: { kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' },
  server: { kind: 'connected', origin: 'http://127.0.0.1:58627' },
};

afterEach(cleanup);

describe('CommandPalette', () => {
  it('exposes current-session runtime and lifecycle callbacks', async () => {
    const user = userEvent.setup();
    const callbacks = {
      onRefreshRuntime: vi.fn(),
      onTogglePlan: vi.fn(),
      onUndo: vi.fn(),
      onOpenCompact: vi.fn(),
      onOpenFork: vi.fn(),
      onOpenArchived: vi.fn(),
    };
    render(
      <CommandPalette
        status={status}
        hasSession
        sessionBusy={false}
        runtimeAvailable
        planMode={false}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRefresh={vi.fn()}
        onChoose={vi.fn()}
        onCreateTask={vi.fn()}
        {...callbacks}
      />,
    );

    for (const [label, callback] of [
      ['刷新任务运行状态', callbacks.onRefreshRuntime],
      ['开启计划模式', callbacks.onTogglePlan],
      ['撤回上一轮', callbacks.onUndo],
      ['压缩上下文…', callbacks.onOpenCompact],
      ['派生新任务…', callbacks.onOpenFork],
      ['查看已归档任务', callbacks.onOpenArchived],
    ] as const) {
      await user.keyboard('{Control>}k{/Control}');
      await user.click(screen.getByRole('option', { name: label }));
      expect(callback).toHaveBeenCalledOnce();
    }
  });

  it('disables structural actions for a busy task', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        status={status}
        hasSession
        sessionBusy
        runtimeAvailable
        planMode
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRefresh={vi.fn()}
        onChoose={vi.fn()}
        onCreateTask={vi.fn()}
        onRefreshRuntime={vi.fn()}
        onTogglePlan={vi.fn()}
        onUndo={vi.fn()}
        onOpenCompact={vi.fn()}
        onOpenFork={vi.fn()}
        onOpenArchived={vi.fn()}
      />,
    );
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('option', { name: '撤回上一轮' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('option', { name: '压缩上下文…' }).getAttribute('aria-disabled')).toBe('true');
  });
});
