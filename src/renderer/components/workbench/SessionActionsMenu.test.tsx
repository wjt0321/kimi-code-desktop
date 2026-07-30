import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionActionDialogs } from './SessionActionDialogs';
import { SessionActionsMenu } from './SessionActionsMenu';

afterEach(cleanup);

describe('SessionActionsMenu', () => {
  it('shows Chinese lifecycle actions', async () => {
    const user = userEvent.setup();
    render(
      <SessionActionsMenu
        busy={false}
        onUndoRequest={vi.fn()}
        onCompactRequest={vi.fn()}
        onForkRequest={vi.fn()}
        onRenameRequest={vi.fn()}
        onArchiveRequest={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '更多任务操作' }));
    expect(screen.getByRole('menuitem', { name: '撤回上一轮' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: '压缩上下文' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: '派生新任务' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: '重命名任务' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: '归档任务' })).not.toBeNull();
  });

  it('disables structural actions while the task is running', async () => {
    const user = userEvent.setup();
    render(
      <SessionActionsMenu
        busy
        onUndoRequest={vi.fn()}
        onCompactRequest={vi.fn()}
        onForkRequest={vi.fn()}
        onRenameRequest={vi.fn()}
        onArchiveRequest={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '更多任务操作' }));
    expect(screen.getByText('任务运行时不可用')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: '撤回上一轮' }).hasAttribute('data-disabled')).toBe(true);
    expect(screen.getByRole('menuitem', { name: '压缩上下文' }).hasAttribute('data-disabled')).toBe(true);
    expect(screen.getByRole('menuitem', { name: '派生新任务' }).hasAttribute('data-disabled')).toBe(true);
  });
});

describe('SessionActionDialogs', () => {
  it('confirms undo and closes only after success', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<SessionActionDialogs action="undo" sessionTitle="示例任务" onClose={onClose} onUndo={onUndo} onCompact={vi.fn()} onFork={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '确认撤回' }));
    await waitFor(() => expect(onUndo).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('trims optional compact instructions and fork titles', async () => {
    const user = userEvent.setup();
    const onCompact = vi.fn().mockResolvedValue(true);
    const onFork = vi.fn().mockResolvedValue(true);
    const { rerender } = render(<SessionActionDialogs action="compact" sessionTitle="示例任务" onClose={vi.fn()} onUndo={vi.fn()} onCompact={onCompact} onFork={onFork} />);

    await user.type(screen.getByRole('textbox', { name: '压缩要求（可选）' }), '  保留测试结论  ');
    await user.click(screen.getByRole('button', { name: '开始压缩' }));
    await waitFor(() => expect(onCompact).toHaveBeenCalledWith('保留测试结论'));

    rerender(<SessionActionDialogs action="fork" sessionTitle="示例任务" onClose={vi.fn()} onUndo={vi.fn()} onCompact={onCompact} onFork={onFork} />);
    await user.type(screen.getByRole('textbox', { name: '新任务标题（可选）' }), '  新分支任务  ');
    await user.click(screen.getByRole('button', { name: '创建新任务' }));
    await waitFor(() => expect(onFork).toHaveBeenCalledWith('新分支任务'));
  });
});
