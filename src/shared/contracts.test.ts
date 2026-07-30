import { describe, expect, it } from 'vitest';

import { DesktopTaskEventSchema, DesktopTaskSnapshotSchema, RenameSessionRequestSchema, WorkspaceRootRequestSchema } from './contracts';

describe('desktop workbench contracts', () => {
  it('accepts a structured task snapshot and a sequenced refresh event', () => {
    expect(DesktopTaskSnapshotSchema.parse({
      session: {
        id: 's_1',
        title: '修复登录',
        updatedAt: '2026-07-29T00:00:00.000Z',
        busy: true,
        cwd: 'C:\\repo',
        pendingInteraction: 'none',
      },
      agentId: 'main',
      timeline: [{
        id: 'f_1',
        kind: 'text',
        role: 'assistant',
        text: '我正在检查。',
        state: 'streaming',
      }],
      todos: [{ id: 'todo_1', title: '复现问题', status: 'in_progress' }],
      tasks: [],
      approvals: [],
      questions: [],
      status: { model: 'kimi-for-coding', permission: 'manual', phase: 'streaming' },
      seq: 8,
    })).toMatchObject({ seq: 8 });

    expect(DesktopTaskEventSchema.parse({
      sessionId: 's_1',
      kind: 'refresh',
      seq: 9,
    })).toEqual({ sessionId: 's_1', kind: 'refresh', seq: 9 });
    expect(WorkspaceRootRequestSchema.parse({ root: 'C:\repo' })).toEqual({ root: 'C:\repo' });
    expect(RenameSessionRequestSchema.parse({ sessionId: 's_1', title: '新的标题' })).toEqual({ sessionId: 's_1', title: '新的标题' });
  });
});
