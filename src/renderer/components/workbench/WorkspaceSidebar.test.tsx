import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesktopSession, DesktopWorkspace } from '../../../shared/contracts';
import { WorkspaceSidebar } from './WorkspaceSidebar';

afterEach(cleanup);
const workspaces: DesktopWorkspace[] = [
  { id: 'a', name: '项目 A', root: 'C:\\a', sessionCount: 1 },
  { id: 'b', name: '项目 B', root: 'D:\\b', sessionCount: 1 },
];
const sessions: DesktopSession[] = [
  { id: 'sa', title: '任务 A', cwd: 'C:\\a', workspaceId: 'a', updatedAt: '2026-07-30T10:00:00Z', busy: false },
  { id: 'sb', title: '任务 B', cwd: 'D:\\b', workspaceId: 'b', updatedAt: '2026-07-30T11:00:00Z', busy: false },
];

describe('WorkspaceSidebar', () => {
  it('restores page pointer events after removing a workspace from its menu', async () => {
    const user = userEvent.setup();
    const onRemoveWorkspace = vi.fn().mockResolvedValue(true);
    render(<WorkspaceSidebar connected workspaces={workspaces} sessions={sessions} selectedSessionId="sb" workspacePages={{}} onSelectTask={vi.fn()} onNewTask={vi.fn()} onAddExisting={vi.fn()} onCreateWorkspace={vi.fn()} onRenameWorkspace={vi.fn()} onRemoveWorkspace={onRemoveWorkspace} onRevealWorkspace={vi.fn()} onRenameTask={vi.fn()} onArchiveTask={vi.fn()} onOpenArchived={vi.fn()} onLoadMore={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '“项目 A”工作区菜单' }));
    await user.click(screen.getByRole('menuitem', { name: '从列表清除' }));
    fireEvent.click(screen.getByRole('button', { name: '从列表清除' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '清除工作区' })).toBeNull());
    expect(onRemoveWorkspace).toHaveBeenCalledWith('a');
    expect(document.body.style.pointerEvents).not.toBe('none');
  });

  it('renders Codex-style workspace groups and keeps tasks nested beneath them', async () => {
    const user = userEvent.setup();
    const onNewTask = vi.fn();
    render(<WorkspaceSidebar connected workspaces={workspaces} sessions={sessions} selectedSessionId="sb" workspacePages={{}} onSelectTask={vi.fn()} onNewTask={onNewTask} onAddExisting={vi.fn()} onCreateWorkspace={vi.fn()} onRenameWorkspace={vi.fn()} onRemoveWorkspace={vi.fn()} onRevealWorkspace={vi.fn()} onRenameTask={vi.fn()} onArchiveTask={vi.fn()} onOpenArchived={vi.fn()} onLoadMore={vi.fn()} />);

    expect(screen.getByRole('region', { name: '工作区 项目 A' })).not.toBeNull();
    expect(screen.getByRole('region', { name: '工作区 项目 B' })).not.toBeNull();
    expect(screen.getByRole('button', { name: /任务 B/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('combobox', { name: /工作区/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: '在“项目 B”中新建任务' }));
    expect(onNewTask).toHaveBeenCalledWith('b');
  });
});

