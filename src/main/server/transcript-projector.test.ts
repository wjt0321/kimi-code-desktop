import { describe, expect, it } from 'vitest';

import { projectTranscript } from './transcript-projector';

describe('projectTranscript', () => {
  it('projects text, running tools, todos and pending approvals from local service data', () => {
    const projected = projectTranscript({
      agent_id: 'main',
      has_more: false,
      seq: 4,
      agents: [],
      pending_interactions: ['approval_1'],
      items: [{
        kind: 'turn',
        turnId: 'turn_1',
        ordinal: 0,
        state: 'running',
        steps: [{
          kind: 'step',
          stepId: 'step_1',
          state: 'running',
          frames: [
            { kind: 'text', frameId: 'f_user', role: 'user', text: '检查构建' },
            { kind: 'tool', frameId: 'f_tool', toolCallId: 'call_1', name: 'shell', state: 'running', input: { command: 'pnpm build' } },
          ],
        }],
      }],
      tasks: [],
      interactions: [],
      attachments: [],
      todos: [{ todoId: 'todo_1', items: [{ title: '检查构建', status: 'in_progress' }] }],
      prompts: [],
      meta: {
        agent: {
          model: 'kimi-for-coding',
          permission: 'manual',
          phase: { kind: 'tool_call', turnId: 0, step: 0, toolCallId: 'call_1', name: 'shell', since: 0 },
        },
      },
    }, {
      items: [{
        approval_id: 'approval_1',
        session_id: 'session_1',
        tool_call_id: 'call_1',
        tool_name: 'shell',
        action: '运行构建',
        tool_input_display: { command: 'pnpm build' },
        created_at: '2026-07-29T00:00:00.000Z',
        expires_at: '2026-07-29T01:00:00.000Z',
      }],
    }, { items: [] });

    expect(projected).toMatchObject({
      agentId: 'main',
      seq: 4,
      timeline: [
        { id: 'f_user', kind: 'text', role: 'user', text: '检查构建', state: 'complete' },
        { id: 'f_tool', kind: 'tool', name: 'shell', state: 'running' },
      ],
      todos: [{ id: 'todo_1:0', title: '检查构建', status: 'in_progress' }],
      approvals: [{ id: 'approval_1', kind: 'approval', toolName: 'shell', action: '运行构建' }],
      questions: [],
      status: { model: 'kimi-for-coding', permission: 'manual', phase: 'tool' },
    });
  });

  it('rejects malformed transcript roots instead of inventing task data', () => {
    expect(() => projectTranscript({ items: [] }, { items: [] }, { items: [] })).toThrow('本地服务返回了不支持的任务记录');
  });
});
