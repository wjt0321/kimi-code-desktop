import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopTaskSnapshot } from '../../../shared/contracts';
import { TaskTimeline } from './TaskTimeline';

const snapshot: DesktopTaskSnapshot = {
  session: { id: 'session-1', title: '任务', updatedAt: '2026-07-30T00:00:00.000Z', busy: false, cwd: 'D:/repo' },
  agentId: 'main',
  timeline: [{ id: 'tool-1', kind: 'tool', toolCallId: 'call-1', approvalId: 'approval-1', name: 'Shell', category: 'shell', state: 'running', summary: '等待执行命令', command: 'pnpm test' }],
  todos: [],
  tasks: [],
  approvals: [{ id: 'approval-1', kind: 'approval', toolName: 'Shell', action: '运行测试', summary: '运行测试', createdAt: '2026-07-30T00:00:00.000Z', toolCallId: 'call-1', block: { kind: 'shell', command: 'pnpm test', cwd: 'D:/repo' } }],
  questions: [],
  status: { phase: 'awaiting_approval' },
};

afterEach(cleanup);

describe('TaskTimeline approvals', () => {
  it('anchors an approval after its matching tool call and forwards decisions', async () => {
    const user = userEvent.setup();
    const onApprovalDecision = vi.fn().mockResolvedValue(true);
    render(<TaskTimeline snapshot={snapshot} loading={false} pendingApprovalIds={[]} onApprovalDecision={onApprovalDecision} />);

    const tool = document.querySelector('[data-tool-call-id="call-1"]');
    const approval = screen.getByRole('article', { name: '待审批：运行测试' });
    expect(tool).not.toBeNull();
    expect(tool && (tool.compareDocumentPosition(approval) & Node.DOCUMENT_POSITION_FOLLOWING)).not.toBe(0);

    await user.click(screen.getByRole('button', { name: '允许一次' }));
    expect(onApprovalDecision).toHaveBeenCalledWith('approval-1', 'approved', undefined, undefined);
  });

  it('renders approvals without a tool anchor at the end of the timeline', () => {
    render(<TaskTimeline snapshot={{ ...snapshot, approvals: [{ id: 'orphan', kind: 'approval', toolName: 'WebFetch', action: '访问外部地址', summary: '访问外部地址', createdAt: '2026-07-30T00:00:00.000Z', block: { kind: 'url', url: 'https://example.test' } }] }} loading={false} pendingApprovalIds={[]} onApprovalDecision={vi.fn()} />);
    expect(screen.getByRole('article', { name: '待审批：访问外部地址' })).not.toBeNull();
  });
});
