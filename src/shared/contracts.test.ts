import { describe, expect, it } from 'vitest';

import {
  DesktopModelSchema,
  DesktopSessionRuntimeSchema,
  DesktopTaskEventSchema,
  DesktopTaskSnapshotSchema,
  RenameSessionRequestSchema,
  UpdateRuntimeRequestSchema,
  WorkspaceRootRequestSchema,
} from './contracts';

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


describe('session runtime contracts', () => {
  it('accepts a server-confirmed runtime state and model thinking metadata', () => {
    expect(DesktopSessionRuntimeSchema.parse({
      available: true,
      model: 'kimi-code/k3',
      thinkingLevel: 'high',
      permission: 'manual',
      planMode: false,
      swarmMode: false,
      contextTokens: 12_000,
      maxContextTokens: 128_000,
      contextUsage: 0.09375,
      warnings: [{ code: 'agents-md-oversized', message: '规则文件过大', severity: 'warning' }],
    })).toMatchObject({ permission: 'manual', thinkingLevel: 'high' });

    expect(DesktopModelSchema.parse({
      id: 'kimi-code/k3',
      label: 'Kimi K3',
      provider: 'kimi-code',
      supportEfforts: ['low', 'high'],
      defaultEffort: 'high',
      adaptiveThinking: true,
      capabilities: ['thinking'],
    })).toMatchObject({ supportEfforts: ['low', 'high'], defaultEffort: 'high' });
  });

  it('rejects invalid runtime values and empty updates', () => {
    expect(() => DesktopSessionRuntimeSchema.parse({
      available: true,
      thinkingLevel: 'high',
      permission: 'unsafe',
      planMode: false,
      swarmMode: false,
      contextTokens: 0,
      maxContextTokens: 0,
      contextUsage: 2,
      warnings: [],
    })).toThrow();
    expect(() => UpdateRuntimeRequestSchema.parse({ sessionId: 's_1' })).toThrow('必须提供至少一项运行策略更新');
    expect(UpdateRuntimeRequestSchema.parse({ sessionId: 's_1', permission: 'auto' })).toEqual({ sessionId: 's_1', permission: 'auto' });
  });
});
