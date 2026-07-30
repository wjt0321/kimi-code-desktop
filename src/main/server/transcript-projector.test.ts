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
            { kind: 'tool', frameId: 'f_tool', toolCallId: 'call_1', name: 'shell', state: 'running', input: { command: 'pnpm build', cwd: 'D:/repo' }, progress: { kind: 'stdout', text: 'building' }, approvalId: 'approval_1' },
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
        tool_input_display: { kind: 'command', command: 'pnpm build', cwd: 'D:/repo' },
        created_at: '2026-07-29T00:00:00.000Z',
        expires_at: '2026-07-29T01:00:00.000Z',
      }],
    }, { items: [] });

    expect(projected).toMatchObject({
      agentId: 'main',
      seq: 4,
      timeline: [
        { id: 'f_user', kind: 'text', role: 'user', text: '检查构建', state: 'complete' },
        { id: 'f_tool', kind: 'tool', name: 'shell', category: 'shell', state: 'running', toolCallId: 'call_1', command: 'pnpm build', cwd: 'D:/repo', progress: { kind: 'stdout', text: 'building' } },
      ],
      todos: [{ id: 'todo_1:0', title: '检查构建', status: 'in_progress' }],
      approvals: [{ id: 'approval_1', kind: 'approval', toolName: 'shell', action: '运行构建', toolCallId: 'call_1', block: { kind: 'shell', command: 'pnpm build', cwd: 'D:/repo' } }],
      questions: [],
      status: { model: 'kimi-for-coding', permission: 'manual', phase: 'tool' },
    });
  });

  it('projects plan review, file diff and malformed displays safely', () => {
    const transcript = {
      agent_id: 'main',
      items: [{ kind: 'turn', steps: [{ kind: 'step', state: 'done', frames: [] }] }],
      todos: [], tasks: [], meta: {},
    };
    const base = {
      session_id: 'session_1', tool_call_id: 'call_1', tool_name: 'ExitPlanMode',
      action: 'review', created_at: '2026-07-30T00:00:00.000Z',
    };
    const projected = projectTranscript(transcript, { items: [
      { ...base, approval_id: 'plan', tool_input_display: { kind: 'plan_review', plan: '# 计划', path: 'plan.md', options: [{ label: '批准', description: '开始' }] } },
      { ...base, approval_id: 'diff', tool_name: 'Edit', tool_input_display: { kind: 'diff', path: 'a.ts', before: 'a', after: 'b' } },
      { ...base, approval_id: 'bad', tool_name: 'Future', tool_input_display: { kind: 'future_kind', payload: true } },
    ] }, { items: [] });

    expect(projected.approvals[0].block).toEqual({ kind: 'plan_review', plan: '# 计划', path: 'plan.md', options: [{ label: '批准', description: '开始' }] });
    expect(projected.approvals[1].block).toMatchObject({ kind: 'diff', path: 'a.ts' });
    expect(projected.approvals[2].block).toEqual({ kind: 'generic', summary: 'review' });
  });
  it('rejects malformed transcript roots instead of inventing task data', () => {
    expect(() => projectTranscript({ items: [] }, { items: [] }, { items: [] })).toThrow('本地服务返回了不支持的任务记录');
  });
});
