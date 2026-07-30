import { describe, expect, it } from 'vitest';

import type { DesktopSession, DesktopStatus, DesktopTaskSnapshot } from '../../../shared/contracts';
import { presentWorkbenchStatus } from './workbench-status';

const readyIdleStatus: DesktopStatus = {
  cli: { kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' },
  server: { kind: 'idle' },
};
const connectedStatus: DesktopStatus = {
  ...readyIdleStatus,
  server: { kind: 'connected', origin: 'http://127.0.0.1:58627' },
};
const runningSession: DesktopSession = {
  id: 'session-1',
  title: '检查登录',
  updatedAt: '2026-07-29T00:00:00.000Z',
  busy: true,
  cwd: 'C:\\repo',
};
const approvalSnapshot: DesktopTaskSnapshot = {
  session: runningSession,
  agentId: 'main',
  timeline: [],
  todos: [],
  tasks: [],
  approvals: [{
    id: 'approval-1',
    kind: 'approval',
    toolName: 'shell',
    action: '执行命令',
    summary: 'pnpm test',
    createdAt: '2026-07-29T00:00:00.000Z',
  }],
  questions: [],
  status: { phase: 'awaiting_approval' },
};

describe('presentWorkbenchStatus', () => {
  it('expresses ready CLI, idle service, and no selected task as readable state', () => {
    expect(presentWorkbenchStatus(readyIdleStatus, undefined, undefined)).toMatchObject({
      cli: { label: 'Kimi CLI 已就绪', detail: '版本 0.30.0', tone: 'ready' },
      service: { label: '服务未启动', action: 'start-service', tone: 'neutral' },
      task: { label: '等待开始', tone: 'neutral' },
    });
  });

  it('gives pending approval precedence over a running task state', () => {
    expect(presentWorkbenchStatus(connectedStatus, runningSession, approvalSnapshot).task).toEqual({
      label: '等待你的审批',
      detail: '有 1 项操作需要确认',
      tone: 'attention',
      action: 'open-context',
    });
  });

  it('maps recoverable CLI and service failures to explicit actions', () => {
    const failedStatus: DesktopStatus = {
      cli: { kind: 'invalid', command: 'C:\\tools\\kimi.cmd', message: '无法运行' },
      server: { kind: 'failed', message: '连接超时' },
    };

    expect(presentWorkbenchStatus(failedStatus, { ...runningSession, busy: false, lastTurnReason: 'failed' }, undefined)).toMatchObject({
      cli: { label: 'CLI 需要处理', tone: 'error', action: 'choose-cli' },
      service: { label: '服务连接失败', tone: 'error', action: 'retry-service' },
      task: { label: '任务失败', tone: 'error' },
    });
  });

  it('distinguishes the inspecting and connecting transitions', () => {
    const checking: DesktopStatus = {
      cli: { kind: 'checking' },
      server: { kind: 'starting', command: 'kimi server' },
    };

    expect(presentWorkbenchStatus(checking, runningSession, {
      ...approvalSnapshot,
      approvals: [],
      status: { phase: 'tool' },
    })).toMatchObject({
      cli: { label: '正在检测 CLI', tone: 'running' },
      service: { label: '正在连接本地服务', tone: 'running' },
      task: { label: '正在执行', tone: 'running' },
    });
  });
});
