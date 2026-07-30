import { describe, expect, it, vi } from 'vitest';

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
