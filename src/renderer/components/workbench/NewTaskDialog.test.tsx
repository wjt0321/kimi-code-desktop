import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DesktopWorkspace } from '../../../shared/contracts';
import { NewTaskDialog } from './NewTaskDialog';

const workspace: DesktopWorkspace = { id: 'ws_1', name: '示例仓库', root: 'C:\\repo', sessionCount: 2 };

describe('NewTaskDialog', () => {
  it('creates a task in the selected real workspace', async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn();
    render(
      <NewTaskDialog
        open
        onOpenChange={vi.fn()}
        workspaces={[workspace]}
        selectedWorkspaceId="ws_1"
        onCreateTask={onCreateTask}
        onChooseFolder={vi.fn()}
        onCreateWorkspace={vi.fn()}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: '任务标题' }), '修复登录');
    await user.click(screen.getByRole('button', { name: '创建任务' }));

    expect(onCreateTask).toHaveBeenCalledWith({ target: 'workspace', workspaceId: 'ws_1', title: '修复登录' });
  });
});
