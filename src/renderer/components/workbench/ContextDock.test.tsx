import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DesktopTaskSnapshot } from '../../../shared/contracts';
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

describe('ContextDock', () => {
  it('puts pending approval first and sends an explicit decision', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(
      <ContextDock
        snapshot={snapshot}
        onApprove={onApprove}
        onReject={vi.fn()}
        onAnswer={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '需要处理（1）' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: '允许一次' }));
    expect(onApprove).toHaveBeenCalledWith('approval-1');
  });
});
