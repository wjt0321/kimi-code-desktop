import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopModel, DesktopSession, DesktopStatus, DesktopTaskSnapshot, DesktopWorkspace } from '../../../shared/contracts';
import { WorkbenchShell } from './WorkbenchShell';

const status: DesktopStatus = {
  cli: { kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' },
  server: { kind: 'connected', origin: 'http://127.0.0.1:58627' },
};
const workspace: DesktopWorkspace = { id: 'ws_1', name: '示例仓库', root: 'C:\\repo', sessionCount: 1 };
const models: DesktopModel[] = [{ id: 'kimi-code/k3', label: 'Kimi K3', provider: 'kimi-code' }];
const session: DesktopSession = {
  id: 'session-1',
  title: '修复登录状态',
  updatedAt: '2026-07-29T00:00:00.000Z',
  busy: true,
  cwd: 'C:\\repo',
  pendingInteraction: 'approval',
  lastPrompt: '检查登录接口',
};
const snapshot: DesktopTaskSnapshot = {
  session,
  agentId: 'main',
  timeline: [{ id: 'tool-1', kind: 'tool', name: 'shell', state: 'running', summary: '正在运行 shell' }],
  todos: [{ id: 'todo-1', title: '复现问题', status: 'in_progress' }],
  tasks: [],
  approvals: [],
  questions: [],
  status: { phase: 'tool', model: 'kimi-for-coding', permission: 'manual' },
};

const actions = {
  onStart: vi.fn(),
  onStop: vi.fn(),
  onSelectWorkspace: vi.fn(),
  onSelectTask: vi.fn(),
  onCreateTask: vi.fn(),
  onSelectModel: vi.fn(),
  onChooseWorkspaceFolder: vi.fn(),
  onCreateWorkspace: vi.fn(),
  onSendPrompt: vi.fn(),
  onAbort: vi.fn(),
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onAnswer: vi.fn(),
  onDismiss: vi.fn(),
};

afterEach(() => cleanup());

describe('WorkbenchShell', () => {
  it('renders a Chinese task-first workbench with only actionable controls', () => {
    render(
      <WorkbenchShell
        status={status}
        workspaces={[workspace]}
        models={models}
        selectedModelId={models[0].id}
        selectedWorkspaceId={workspace.id}
        sessions={[session]}
        selectedSession={session}
        snapshot={snapshot}
        loading={false}
        error={undefined}
        {...actions}
      />,
    );

    expect(screen.getByRole('navigation', { name: '工作台导航' })).not.toBeNull();
    expect(screen.getAllByRole('button', { name: '新建任务' }).some((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByText('等待审批')).not.toBeNull();
    expect(screen.getByText('正在运行 shell')).not.toBeNull();
    expect(screen.getByRole('textbox', { name: '向 Kimi Code 发送任务' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: '项目' })).toBeNull();
  });

  it('opens a local folder as a first-class workspace entry when none exists', async () => {
    const user = userEvent.setup();
    const chooseFolder = vi.fn().mockResolvedValue('C:\repo');
    const createWorkspace = vi.fn().mockResolvedValue(workspace);

    render(
      <WorkbenchShell
        status={status}
        workspaces={[]}
        models={models}
        selectedModelId={undefined}
        selectedWorkspaceId={undefined}
        sessions={[]}
        selectedSession={undefined}
        snapshot={undefined}
        loading={false}
        error={undefined}
        {...actions}
        onChooseWorkspaceFolder={chooseFolder}
        onCreateWorkspace={createWorkspace}
      />,
    );

    await user.click(screen.getByRole('button', { name: '打开本机文件夹' }));

    expect(chooseFolder).toHaveBeenCalledOnce();
    await waitFor(() => expect(createWorkspace).toHaveBeenCalledWith('C:\repo'));
    expect(screen.getByRole('dialog', { name: '新建任务' })).not.toBeNull();
  });

  it('provides task search and explicit task management controls', async () => {
    const user = userEvent.setup();
    render(
      <WorkbenchShell
        status={status}
        workspaces={[workspace]}
        models={models}
        selectedModelId={models[0].id}
        selectedWorkspaceId={workspace.id}
        sessions={[session]}
        selectedSession={session}
        snapshot={snapshot}
        loading={false}
        error={undefined}
        {...actions}
        onRenameTask={vi.fn()}
        onArchiveTask={vi.fn()}
      />,
    );

    expect(screen.getByRole('searchbox', { name: '搜索任务' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '设置与关于' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '重命名任务' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '归档任务' })).not.toBeNull();

    await user.type(screen.getByRole('searchbox', { name: '搜索任务' }), '不存在的任务');
    expect(screen.queryByRole('button', { name: /修复登录状态/ })).toBeNull();
    expect(screen.getByText('没有匹配的任务')).not.toBeNull();
  });


});
