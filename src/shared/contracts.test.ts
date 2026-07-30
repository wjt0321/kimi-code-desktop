import { describe, expect, it } from 'vitest';

import {
  DesktopApprovalSchema,
  DesktopCapabilitySnapshotSchema,
  DesktopDiffLineSchema,
  DesktopModelSchema,
  DesktopTimelineEntrySchema,
  DesktopSessionRuntimeSchema,
  DesktopTaskEventSchema,
  DesktopTaskSchema,
  DesktopTaskSnapshotSchema,
  CopyTextRequestSchema,
  RenameSessionRequestSchema,
  RevealPathRequestSchema,
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
describe('rich execution contracts', () => {
  it('accepts a structured shell tool and plan review approval', () => {
    expect(DesktopTimelineEntrySchema.parse({
      id: 'frame-1',
      kind: 'tool',
      toolCallId: 'call-1',
      name: 'Shell',
      category: 'shell',
      state: 'running',
      title: '运行命令',
      summary: 'pnpm test',
      command: 'pnpm test',
      cwd: 'D:/example',
      progress: { kind: 'stdout', text: 'RUN v4' },
    })).toMatchObject({ category: 'shell', command: 'pnpm test' });

    expect(DesktopApprovalSchema.parse({
      id: 'approval-1',
      kind: 'approval',
      toolName: 'ExitPlanMode',
      action: 'review',
      summary: '审阅计划',
      createdAt: '2026-07-30T00:00:00.000Z',
      toolCallId: 'call-1',
      block: {
        kind: 'plan_review',
        plan: '# 实施计划',
        path: 'plan.md',
        options: [{ label: '批准并实施', description: '开始编码' }],
      },
    }).block).toMatchObject({ kind: 'plan_review', path: 'plan.md' });
  });

  it('rejects invalid progress and diff values', () => {
    expect(() => DesktopTimelineEntrySchema.parse({
      id: 'frame-1',
      kind: 'tool',
      name: 'Shell',
      category: 'shell',
      state: 'running',
      title: '运行命令',
      summary: 'pnpm test',
      progress: { kind: 'progress', percent: 101 },
    })).toThrow();

    expect(() => DesktopDiffLineSchema.parse({ type: 'add', text: 'line', oldNo: 0, newNo: -1 })).toThrow();
  });
});
describe('review action contracts', () => {
  it('accepts absolute Windows paths and bounded clipboard text', () => {
    expect(RevealPathRequestSchema.parse({ path: 'D:\\repo\\src\\app.ts' })).toEqual({ path: 'D:\\repo\\src\\app.ts' });
    expect(CopyTextRequestSchema.parse({ text: 'diff content' })).toEqual({ text: 'diff content' });
  });

  it('rejects relative paths and oversized clipboard values', () => {
    expect(() => RevealPathRequestSchema.parse({ path: 'src/app.ts' })).toThrow('必须提供绝对路径');
    expect(() => CopyTextRequestSchema.parse({ text: 'x'.repeat(200_001) })).toThrow();
  });
});


describe('desktop capability contracts', () => {
  it('accepts a ready capability snapshot for CLI compatibility mode', () => {
    expect(DesktopCapabilitySnapshotSchema.parse({
      phase: 'ready',
      desktopVersion: '0.5.0',
      cliVersion: '0.30.0',
      serverVersion: '0.30.0',
      checkedAt: '2026-07-30T08:00:00.000Z',
      compatibilityMode: true,
      capabilities: {
        sessionRuntime: 'supported',
        sessionWarnings: 'supported',
        transcript: 'supported',
        config: 'supported',
        secondaryModel: 'unsupported',
        managedUserInfo: 'unsupported',
        promptProfile: 'unsupported',
        nonBlockingTaskOutput: 'unsupported',
      },
    })).toMatchObject({ phase: 'ready', compatibilityMode: true });
  });

  it('rejects invalid capability states', () => {
    expect(() => DesktopCapabilitySnapshotSchema.parse({
      phase: 'ready',
      desktopVersion: '0.5.0',
      compatibilityMode: false,
      capabilities: {
        sessionRuntime: 'yes',
        sessionWarnings: 'unknown',
        transcript: 'unknown',
        config: 'unknown',
        secondaryModel: 'unknown',
        managedUserInfo: 'unknown',
        promptProfile: 'unknown',
        nonBlockingTaskOutput: 'unknown',
      },
    })).toThrow();
  });

  it('accepts optional live task detail without requiring it from CLI 0.30', () => {
    expect(DesktopTaskSchema.parse({
      id: 'task-1',
      title: '检查项目',
      kind: 'subagent',
      state: 'running',
      outputTail: '已读取文件',
      detached: true,
      agentId: 'agent-2',
      activityHint: 'waiting_notification',
      updatedAt: '2026-07-30T08:00:00.000Z',
    })).toMatchObject({ detached: true, activityHint: 'waiting_notification' });

    expect(DesktopTaskSchema.parse({
      id: 'task-legacy',
      title: '旧任务',
      kind: 'other',
      state: 'running',
      outputTail: '',
    }).activityHint).toBeUndefined();
  });
});
