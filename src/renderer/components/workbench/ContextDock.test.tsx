import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopSessionRuntime, DesktopTaskSnapshot } from '../../../shared/contracts';
import { ContextDock } from './ContextDock';

const snapshot: DesktopTaskSnapshot = {
  session: { id: 'session-1', title: '修复登录', updatedAt: '2026-07-29T00:00:00.000Z', busy: true, cwd: 'C:\\repo' },
  agentId: 'main',
  timeline: [],
  todos: [{ id: 'todo-1', title: '复现问题', status: 'in_progress' }],
  tasks: [],
  approvals: [{ id: 'approval-1', kind: 'approval', toolName: 'shell', action: '运行构建', summary: 'pnpm build', createdAt: '2026-07-29T00:00:00.000Z' }],
  questions: [],
  status: { phase: 'awaiting_approval' },
};

const runtime: DesktopSessionRuntime = {
  available: true,
  model: 'kimi-code/k3',
  thinkingLevel: 'high',
  permission: 'auto',
  planMode: true,
  swarmMode: false,
  contextTokens: 12000,
  maxContextTokens: 128000,
  contextUsage: 0.09375,
  warnings: [{ code: 'context', message: '上下文即将需要压缩', severity: 'warning' }],
};

afterEach(cleanup);

describe('ContextDock', () => {
  it('puts a compact pending approval shortcut first', async () => {
    const user = userEvent.setup();
    render(
      <ContextDock
        snapshot={snapshot}
        runtime={runtime}
        runtimeLoading={false}
        onRefreshRuntime={vi.fn()}
        onAnswer={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '需要处理（1）' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: '允许一次' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '在执行记录中查看：运行构建' }));
  });

  it('renders confirmed runtime details, warnings, and refresh action', async () => {
    const user = userEvent.setup();
    const onRefreshRuntime = vi.fn();
    render(
      <ContextDock
        snapshot={{ ...snapshot, approvals: [] }}
        runtime={runtime}
        runtimeLoading={false}
        onRefreshRuntime={onRefreshRuntime}
        onAnswer={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('上下文 12,000 / 128,000')).not.toBeNull();
    expect(screen.getByText('思考强度 高')).not.toBeNull();
    expect(screen.getByText('权限 完全自动')).not.toBeNull();
    expect(screen.getByText('计划模式 已开启')).not.toBeNull();
    expect(screen.getByRole('status', { name: '警告：上下文即将需要压缩' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: '刷新运行状态' }));
    expect(onRefreshRuntime).toHaveBeenCalledOnce();
  });

});
