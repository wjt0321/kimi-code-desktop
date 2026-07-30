import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopModel, DesktopSession, DesktopStatus, DesktopTaskSnapshot, DesktopWorkspace } from '../shared/contracts';
import { App } from './App';

const cliCommand = 'C:\\Users\\example\\AppData\\Roaming\\npm\\kimi.cmd';
const readyStatus: DesktopStatus = {
  cli: { kind: 'ready', command: cliCommand, version: '0.30.0' },
  server: { kind: 'idle' },
};
const connectedStatus: DesktopStatus = {
  ...readyStatus,
  server: { kind: 'connected', origin: 'http://127.0.0.1:59147' },
};
const workspace: DesktopWorkspace = { id: 'ws_1', name: '示例仓库', root: 'C:\\workspace', sessionCount: 1 };
const models: DesktopModel[] = [{ id: 'kimi-code/k3', label: 'Kimi K3', provider: 'kimi-code' }];
const task: DesktopSession = {
  id: 'task-1',
  title: '检查桌面端界面',
  updatedAt: '2026-07-29T12:00:00.000Z',
  busy: false,
  cwd: 'C:\\workspace',
  workspaceId: 'ws_1',
};
const snapshot: DesktopTaskSnapshot = {
  session: task,
  agentId: 'main',
  timeline: [{ id: 'message-1', kind: 'text', role: 'assistant', text: '我已经准备好了。', state: 'complete' }],
  todos: [],
  tasks: [],
  approvals: [],
  questions: [],
  status: { phase: 'idle', model: 'kimi-for-coding', permission: 'manual' },
};

const snapshotWithApproval: DesktopTaskSnapshot = {
  ...snapshot,
  approvals: [{
    id: 'approval-1',
    kind: 'approval',
    toolName: 'shell',
    action: '执行命令',
    summary: 'pnpm test',
    createdAt: '2026-07-29T12:01:00.000Z',
  }],
};

const desktopApi = {
  status: vi.fn<() => Promise<DesktopStatus>>(),
  refreshCli: vi.fn<() => Promise<DesktopStatus>>(),
  chooseCliExecutable: vi.fn<() => Promise<DesktopStatus>>(),
  startServer: vi.fn<() => Promise<DesktopStatus>>(),
  stopServer: vi.fn<() => Promise<DesktopStatus>>(),
  listWorkspaces: vi.fn<() => Promise<DesktopWorkspace[]>>(),
  listSessions: vi.fn<() => Promise<DesktopSession[]>>(),
  listModels: vi.fn<() => Promise<DesktopModel[]>>(),
  getTaskSnapshot: vi.fn<(sessionId: string) => Promise<DesktopTaskSnapshot>>(),
  watchTask: vi.fn<(input: { sessionId: string; agentId: string }) => Promise<void>>(),
  unwatchTask: vi.fn<(sessionId?: string) => Promise<void>>(),
  createTask: vi.fn<() => Promise<DesktopSession | null>>(),
  createWorkspace: vi.fn(),
  chooseWorkspaceFolder: vi.fn(),
  listMessages: vi.fn(),
  submitPrompt: vi.fn<(input: { sessionId: string; text: string; model: string }) => Promise<void>>(),
  abortSession: vi.fn<(sessionId: string) => Promise<void>>(),
  respondApproval: vi.fn(),
  respondQuestion: vi.fn(),
  dismissQuestion: vi.fn(),
  onStatus: vi.fn<(listener: (status: DesktopStatus) => void) => () => void>(),
  onTaskEvent: vi.fn<(listener: (event: { sessionId: string; kind: 'refresh'; seq?: number }) => void) => () => void>(),
};

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  desktopApi.status.mockResolvedValue(readyStatus);
  desktopApi.refreshCli.mockResolvedValue(readyStatus);
  desktopApi.chooseCliExecutable.mockResolvedValue(readyStatus);
  desktopApi.startServer.mockResolvedValue({ ...readyStatus, server: { kind: 'starting', command: cliCommand } });
  desktopApi.stopServer.mockResolvedValue(readyStatus);
  desktopApi.listWorkspaces.mockResolvedValue([]);
  desktopApi.listSessions.mockResolvedValue([]);
  desktopApi.listModels.mockResolvedValue([]);
  desktopApi.getTaskSnapshot.mockResolvedValue(snapshot);
  desktopApi.watchTask.mockResolvedValue();
  desktopApi.unwatchTask.mockResolvedValue();
  desktopApi.createTask.mockResolvedValue(null);
  desktopApi.submitPrompt.mockResolvedValue();
  desktopApi.abortSession.mockResolvedValue();
  desktopApi.onStatus.mockReturnValue(() => undefined);
  desktopApi.onTaskEvent.mockReturnValue(() => undefined);
  Object.defineProperty(window, 'desktop', { configurable: true, value: desktopApi });
});

describe('App', () => {
  it('在 CLI 就绪但服务未连接时提供启动本地服务操作', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click((await screen.findAllByRole('button', { name: '启动本地服务' }))[0]);

    expect(desktopApi.startServer).toHaveBeenCalledOnce();
  });

  it('通过 Ctrl+K 打开中文命令面板', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('服务未启动');

    await user.keyboard('{Control>}k{/Control}');

    expect(screen.getByRole('dialog', { name: '命令面板' })).not.toBeNull();
  });

  it('在已连接但没有工作区时展示品牌状态和打开文件夹入口', async () => {
    desktopApi.status.mockResolvedValue(connectedStatus);
    desktopApi.listWorkspaces.mockResolvedValue([]);
    desktopApi.listSessions.mockResolvedValue([]);
    desktopApi.listModels.mockResolvedValue([]);
    render(<App />);

    expect((await screen.findByRole('button', { name: '打开本机文件夹' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('Kimi CLI 已就绪')).not.toBeNull();
    expect(screen.getByText('本机服务已连接')).not.toBeNull();
    expect(screen.getAllByAltText('Kimi Code').length).toBeGreaterThanOrEqual(1);
  });

  it('从命令面板打开新建任务对话框而不绕过工作区选择', async () => {
    const user = userEvent.setup();
    desktopApi.status.mockResolvedValue(connectedStatus);
    desktopApi.listWorkspaces.mockResolvedValue([workspace]);
    desktopApi.listSessions.mockResolvedValue([]);
    desktopApi.listModels.mockResolvedValue([]);
    render(<App />);

    await user.keyboard('{Control>}k{/Control}');
    await user.click(await screen.findByRole('option', { name: '新建任务' }));

    expect(screen.getByRole('dialog', { name: '新建任务' })).not.toBeNull();
    expect(desktopApi.createTask).not.toHaveBeenCalled();
  });

  it('加载已连接任务并通过安全桥发送中文工作台输入', async () => {
    const user = userEvent.setup();
    desktopApi.status.mockResolvedValue(connectedStatus);
    desktopApi.listWorkspaces.mockResolvedValue([workspace]);
    desktopApi.listSessions.mockResolvedValue([task]);
    desktopApi.listModels.mockResolvedValue(models);
    render(<App />);

    expect(await screen.findByText('我已经准备好了。')).not.toBeNull();
    const prompt = screen.getByRole('textbox', { name: '向 Kimi Code 发送任务' });
    expect((prompt as HTMLTextAreaElement).disabled).toBe(false);
    await user.type(prompt, '解释当前任务');
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText('选择模型'), 'kimi-code/k3');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(desktopApi.submitPrompt).toHaveBeenCalledWith({ sessionId: 'task-1', text: '解释当前任务', model: 'kimi-code/k3' });
    });
  });

  it('在中文工作台中打开待处理上下文并提交明确的审批决定', async () => {
    const user = userEvent.setup();
    desktopApi.status.mockResolvedValue(connectedStatus);
    desktopApi.listWorkspaces.mockResolvedValue([workspace]);
    desktopApi.listSessions.mockResolvedValue([{ ...task, pendingInteraction: 'approval' }]);
    desktopApi.getTaskSnapshot.mockResolvedValue(snapshotWithApproval);
    render(<App />);

    await user.click(await screen.findByRole('button', { name: '待处理 1' }));
    expect(screen.getByRole('heading', { name: '需要处理（1）' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: '允许一次' }));

    await waitFor(() => {
      expect(desktopApi.respondApproval).toHaveBeenCalledWith({
        sessionId: 'task-1',
        approvalId: 'approval-1',
        decision: 'approved',
      });
    });
  });
});
