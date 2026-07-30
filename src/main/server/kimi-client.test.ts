import { describe, expect, it, vi } from 'vitest';

import { LocalServiceRequestError } from './server-lifecycle';
import { KimiDesktopClient } from './kimi-client';

describe('KimiDesktopClient', () => {
  it('unwraps the installed CLI envelope before mapping a selected workspace', async () => {
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      expect(path).toBe('/workspaces');
      expect(init).toMatchObject({ method: 'POST' });
      return {
        code: 0,
        msg: 'success',
        data: { id: 'ws-folder', name: '桌面端', root: 'D:\\mydev\\kimi-code\\desktop', session_count: 0 },
        request_id: 'request-example',
      };
    });
    const client = new KimiDesktopClient({ request });

    await expect(client.createWorkspace('D:\\mydev\\kimi-code\\desktop')).resolves.toEqual({
      id: 'ws-folder',
      name: '桌面端',
      root: 'D:\\mydev\\kimi-code\\desktop',
      sessionCount: 0,
    });
  });
  it('treats the installed CLI default empty model as unspecified when listing sessions', async () => {
    const request = vi.fn(async () => ({
      code: 0,
      msg: 'success',
      data: {
        items: [{
          id: 'session-empty-model',
          title: '',
          updated_at: '2026-07-29T12:00:00.000Z',
          busy: false,
          metadata: { cwd: 'D:\\workspace' },
          agent_config: { model: '' },
        }],
      },
    }));
    const client = new KimiDesktopClient({ request });

    await expect(client.listSessions()).resolves.toEqual([{
      id: 'session-empty-model',
      title: '未命名任务',
      updatedAt: '2026-07-29T12:00:00.000Z',
      busy: false,
      cwd: 'D:\\workspace',
    }]);
  });
  it('lists available models and sends the selected model with a prompt', async () => {
    const request = vi.fn(async (path: string) => {
      if (path === '/models') {
        return {
          code: 0,
          msg: 'success',
          data: {
            items: [{
              provider: 'kimi-code',
              model: 'kimi-code/k3',
              display_name: 'Kimi K3',
              max_context_size: 256000,
              capabilities: ['thinking', 'tool_use'],
            }],
          },
        };
      }
      return { code: 0, msg: 'success', data: { prompt_id: 'prompt-1' } };
    });
    const client = new KimiDesktopClient({ request });

    await expect(client.listModels()).resolves.toEqual([{
      id: 'kimi-code/k3',
      label: 'Kimi K3',
      provider: 'kimi-code',
      contextWindow: 256000,
      capabilities: ['thinking', 'tool_use'],
      supportEfforts: undefined,
      defaultEffort: undefined,
      adaptiveThinking: undefined,
    }]);
    await client.submitPrompt('session-1', '请回复你好', 'kimi-code/k3');

    expect(request).toHaveBeenLastCalledWith('/sessions/session-1/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: [{ type: 'text', text: '请回复你好' }],
        model: 'kimi-code/k3',
      }),
    });
  });

  it('maps sessions and sends a selected model with its prompt to the local API route', async () => {
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/sessions?')) {
        return {
          items: [{
            id: 'session-1',
            title: 'Investigate desktop client',
            updated_at: '2026-07-29T12:00:00.000Z',
            busy: false,
            metadata: { cwd: 'C:\\workspace' },
            last_prompt: 'Check the design',
          }],
        };
      }
      return { prompt_id: 'prompt-1' };
    });
    const client = new KimiDesktopClient({ request });

    await expect(client.listSessions()).resolves.toEqual([{
      id: 'session-1',
      title: 'Investigate desktop client',
      updatedAt: '2026-07-29T12:00:00.000Z',
      busy: false,
      cwd: 'C:\\workspace',
      lastPrompt: 'Check the design',
    }]);
    await client.submitPrompt('session-1', 'Summarize the next step', 'kimi-code/k3');

    expect(request).toHaveBeenLastCalledWith('/sessions/session-1/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [{ type: 'text', text: 'Summarize the next step' }], model: 'kimi-code/k3' }),
    });
  });
});

  it('maps workspaces, creates a workspace task, and combines the task snapshot routes', async () => {
    const request = vi.fn(async (path: string) => {
      if (path === '/workspaces') {
        return { items: [{ id: 'ws-1', name: '示例仓库', root: 'C:\\repo', session_count: 2 }] };
      }
      if (path === '/sessions') {
        return {
          id: 'session-1',
          title: '构建桌面端',
          updated_at: '2026-07-29T12:00:00.000Z',
          busy: true,
          workspace_id: 'ws-1',
          pending_interaction: 'approval',
          metadata: { cwd: 'C:\\repo' },
          agent_config: { model: 'kimi-for-coding', permission_mode: 'manual' },
        };
      }
      if (path === '/sessions/session-1') {
        return {
          id: 'session-1',
          title: '构建桌面端',
          updated_at: '2026-07-29T12:00:00.000Z',
          busy: true,
          workspace_id: 'ws-1',
          pending_interaction: 'approval',
          metadata: { cwd: 'C:\\repo' },
          agent_config: { model: 'kimi-for-coding', permission_mode: 'manual' },
        };
      }
      if (path === '/sessions/session-1/transcript?agent_id=main') {
        return {
          agent_id: 'main',
          items: [],
          tasks: [],
          interactions: [],
          attachments: [],
          todos: [],
          prompts: [],
          meta: { agent: { model: 'kimi-for-coding', permission: 'manual', phase: { kind: 'idle' } } },
        };
      }
      if (path === '/sessions/session-1/approvals?status=pending' || path === '/sessions/session-1/questions?status=pending') {
        return { items: [] };
      }
      return { resolved: true };
    });
    const client = new KimiDesktopClient({ request });

    await expect(client.listWorkspaces()).resolves.toEqual([{ id: 'ws-1', name: '示例仓库', root: 'C:\\repo', sessionCount: 2 }]);
    await expect(client.createTask({ target: 'workspace', workspaceId: 'ws-1', title: '构建桌面端' })).resolves.toMatchObject({ workspaceId: 'ws-1' });
    await expect(client.getTaskSnapshot('session-1')).resolves.toMatchObject({ agentId: 'main', approvals: [] });
    await client.respondApproval({ sessionId: 'session-1', approvalId: 'approval-1', decision: 'approved' });

    expect(request).toHaveBeenCalledWith('/sessions/session-1/transcript?agent_id=main', undefined);
    expect(request).toHaveBeenCalledWith('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'ws-1', title: '构建桌面端' }),
    });
    expect(request).toHaveBeenLastCalledWith('/sessions/session-1/approvals/approval-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approved' }),
    });
  });

it('renames and archives sessions through the current server action routes', async () => {
  const request = vi.fn(async () => ({ code: 0, msg: 'success', data: { archived: true } }));
  const client = new KimiDesktopClient({ request });

  await client.renameSession('session / 1', '新的任务标题');
  await client.archiveSession('session / 1');

  expect(request).toHaveBeenNthCalledWith(1, '/sessions/session%20%2F%201', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '新的任务标题' }),
  });
  expect(request).toHaveBeenNthCalledWith(2, '/sessions/session%20%2F%201:archive', {
    method: 'POST',
  });
});


describe('KimiDesktopClient runtime controls', () => {
  it('maps live runtime status, warnings, archived sessions, and model effort metadata', async () => {
    const request = vi.fn(async (path: string) => {
      if (path === '/sessions/s1/status') return {
        busy: false,
        model: 'kimi-code/k3',
        thinking_level: 'high',
        permission: 'auto',
        plan_mode: true,
        swarm_mode: false,
        context_tokens: 12000,
        max_context_tokens: 128000,
        context_usage: 0.09375,
      };
      if (path === '/sessions/s1/warnings') return {
        warnings: [{ code: 'agents-md-oversized', message: '规则文件过大', severity: 'warning' }],
      };
      if (path === '/sessions?page_size=80&archived_only=true') return {
        items: [{
          id: 'archived-1',
          title: '旧任务',
          updated_at: '2026-07-30T00:00:00.000Z',
          busy: false,
          archived: true,
          metadata: { cwd: 'C:\\repo' },
          agent_config: { model: '' },
        }],
      };
      if (path === '/models') return {
        items: [{
          provider: 'kimi-code',
          model: 'kimi-code/k3',
          display_name: 'Kimi K3',
          max_context_size: 128000,
          capabilities: ['thinking'],
          support_efforts: ['low', 'high'],
          default_effort: 'high',
          adaptive_thinking: true,
        }],
      };
      throw new Error(`unexpected path ${path}`);
    });
    const client = new KimiDesktopClient({ request });

    await expect(client.getSessionRuntime('s1')).resolves.toMatchObject({
      available: true,
      model: 'kimi-code/k3',
      thinkingLevel: 'high',
      permission: 'auto',
      planMode: true,
      contextTokens: 12000,
      warnings: [{ code: 'agents-md-oversized' }],
    });
    await expect(client.listArchivedSessions()).resolves.toMatchObject([{ id: 'archived-1', title: '旧任务' }]);
    await expect(client.listModels()).resolves.toMatchObject([{
      supportEfforts: ['low', 'high'],
      defaultEffort: 'high',
      adaptiveThinking: true,
    }]);
  });

  it('updates runtime fields and reads back the server-confirmed state', async () => {
    const request = vi.fn(async (path: string) => {
      if (path === '/sessions/s1/profile') return { id: 's1' };
      if (path === '/sessions/s1/status') return {
        busy: false,
        model: 'kimi-code/k3',
        thinking_level: 'max',
        permission: 'auto',
        plan_mode: true,
        swarm_mode: false,
        context_tokens: 10,
        max_context_tokens: 100,
        context_usage: 0.1,
      };
      if (path === '/sessions/s1/warnings') return { warnings: [] };
      throw new Error(`unexpected path ${path}`);
    });
    const client = new KimiDesktopClient({ request });

    await expect(client.updateSessionRuntime({
      sessionId: 's1',
      model: 'kimi-code/k3',
      thinkingLevel: 'max',
      permission: 'auto',
      planMode: true,
    })).resolves.toMatchObject({ thinkingLevel: 'max', permission: 'auto', planMode: true });

    expect(request).toHaveBeenNthCalledWith(1, '/sessions/s1/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_config: {
          model: 'kimi-code/k3',
          thinking: 'max',
          permission_mode: 'auto',
          plan_mode: true,
        },
      }),
    });
  });

  it('sends compact, undo, fork, and restore requests to their action routes', async () => {
    const session = {
      id: 'forked-1',
      title: '派生任务',
      updated_at: '2026-07-30T00:00:00.000Z',
      busy: false,
      metadata: { cwd: 'C:\\repo' },
      agent_config: { model: '' },
    };
    const request = vi.fn(async (path: string) => path.includes(':fork') || path.includes(':restore') ? session : {});
    const client = new KimiDesktopClient({ request });

    await client.compactSession({ sessionId: 's / 1', instruction: '保留关键决策' });
    await client.undoSession({ sessionId: 's / 1', count: 1 });
    await expect(client.forkSession({ sessionId: 's / 1', title: '派生任务' })).resolves.toMatchObject({ id: 'forked-1' });
    await expect(client.restoreSession({ sessionId: 's / 1' })).resolves.toMatchObject({ id: 'forked-1' });

    expect(request).toHaveBeenNthCalledWith(1, '/sessions/s%20%2F%201:compact', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ instruction: '保留关键决策' }),
    }));
    expect(request).toHaveBeenNthCalledWith(2, '/sessions/s%20%2F%201:undo', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ count: 1 }),
    }));
    expect(request).toHaveBeenNthCalledWith(3, '/sessions/s%20%2F%201:fork', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: '派生任务' }),
    }));
    expect(request).toHaveBeenNthCalledWith(4, '/sessions/s%20%2F%201:restore', { method: 'POST' });
  });

  it('degrades only unsupported runtime reads and preserves other failures', async () => {
    const unsupported = new KimiDesktopClient({
      request: vi.fn(async () => { throw new LocalServiceRequestError('route not found', 404); }),
    });
    await expect(unsupported.getSessionRuntime('s1')).resolves.toMatchObject({ available: false });
    await expect(unsupported.updateSessionRuntime({ sessionId: 's1', planMode: true })).rejects.toThrow('当前 Kimi Code CLI 版本暂不支持运行策略控制');

    const broken = new KimiDesktopClient({
      request: vi.fn(async () => { throw new LocalServiceRequestError('server failure', 500); }),
    });
    await expect(broken.getSessionRuntime('s1')).rejects.toThrow('server failure');
  });
});
