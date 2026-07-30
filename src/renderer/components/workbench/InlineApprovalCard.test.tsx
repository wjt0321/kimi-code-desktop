import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopApproval } from '../../../shared/contracts';
import { InlineApprovalCard } from './InlineApprovalCard';

const shellApproval: DesktopApproval = {
  id: 'approval-shell',
  kind: 'approval',
  toolName: 'Shell',
  action: '运行构建命令',
  summary: 'Kimi Code 想运行 pnpm build',
  createdAt: '2026-07-30T00:00:00.000Z',
  toolCallId: 'call-shell',
  block: { kind: 'shell', command: 'pnpm build', cwd: 'D:/repo', danger: '命令会执行本地脚本' },
};

afterEach(cleanup);

describe('InlineApprovalCard', () => {
  it('shows structured shell context and submits optional feedback', async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn().mockResolvedValue(true);
    render(<InlineApprovalCard approval={shellApproval} pending={false} onDecision={onDecision} />);

    expect(screen.getByText('运行构建命令')).not.toBeNull();
    expect(screen.getByText('pnpm build')).not.toBeNull();
    expect(screen.getByText('D:/repo')).not.toBeNull();
    expect(screen.getByText('命令会执行本地脚本')).not.toBeNull();

    await user.type(screen.getByRole('textbox', { name: '审批反馈' }), '已经检查过');
    await user.click(screen.getByRole('button', { name: '允许一次' }));
    expect(onDecision).toHaveBeenCalledWith('approved', '已经检查过', undefined);
  });

  it('submits the selected plan review option', async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn().mockResolvedValue(true);
    render(<InlineApprovalCard approval={{ ...shellApproval, id: 'plan', action: '审阅实施计划', block: { kind: 'plan_review', plan: '# 计划\n\n先测试，再实现。', path: 'plan.md', options: [{ label: '批准并开始', description: '按计划执行' }, { label: '仅批准第一阶段' }] } }} pending={false} onDecision={onDecision} />);

    expect(screen.getByText('先测试，再实现。')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: /批准并开始/ }));
    expect(onDecision).toHaveBeenCalledWith('approved', undefined, '批准并开始');
  });

  it('keeps feedback when a decision fails and disables controls while pending', async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn().mockResolvedValue(false);
    const { rerender } = render(<InlineApprovalCard approval={shellApproval} pending={false} onDecision={onDecision} />);
    const feedback = screen.getByRole('textbox', { name: '审批反馈' });
    await user.type(feedback, '请调整');
    await user.click(screen.getByRole('button', { name: '拒绝' }));
    expect((feedback as HTMLTextAreaElement).value).toBe('请调整');

    rerender(<InlineApprovalCard approval={shellApproval} pending onDecision={onDecision} />);
    expect((screen.getByRole('button', { name: '正在提交审批' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('textbox', { name: '审批反馈' }) as HTMLTextAreaElement).disabled).toBe(true);
  });
});
