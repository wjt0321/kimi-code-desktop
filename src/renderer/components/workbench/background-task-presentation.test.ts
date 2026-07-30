import { describe, expect, it } from 'vitest';

import type { DesktopTask } from '../../../shared/contracts';
import { presentBackgroundTask } from './background-task-presentation';

const runningTask: DesktopTask = {
  id: 'task-1',
  title: '检查项目',
  kind: 'subagent',
  state: 'running',
  outputTail: '',
};

describe('presentBackgroundTask', () => {
  it('distinguishes running progress and completion notification states', () => {
    expect(presentBackgroundTask(runningTask)).toMatchObject({ stateLabel: '运行中', tone: 'running', spinning: true });
    expect(presentBackgroundTask({ ...runningTask, outputTail: '50%' })).toMatchObject({ stateLabel: '已有进展', tone: 'progress' });
    expect(presentBackgroundTask({ ...runningTask, activityHint: 'waiting_notification' })).toMatchObject({ stateLabel: '等待完成通知', tone: 'waiting' });
  });

  it('localizes every terminal state without exposing protocol names', () => {
    expect(presentBackgroundTask({ ...runningTask, state: 'completed', resultSummary: '检查完成' })).toMatchObject({ stateLabel: '已完成', tone: 'completed', detail: '检查完成' });
    expect(presentBackgroundTask({ ...runningTask, state: 'failed' })).toMatchObject({ stateLabel: '失败', tone: 'failed' });
    expect(presentBackgroundTask({ ...runningTask, state: 'timed_out' })).toMatchObject({ stateLabel: '已超时', tone: 'failed' });
    expect(presentBackgroundTask({ ...runningTask, state: 'killed' })).toMatchObject({ stateLabel: '已取消', tone: 'cancelled' });
    expect(presentBackgroundTask({ ...runningTask, state: 'lost' })).toMatchObject({ stateLabel: '状态未知', tone: 'unknown' });
  });

  it('uses a state reason before a generic explanation', () => {
    expect(presentBackgroundTask({ ...runningTask, stateReason: '等待远程结果' }).detail).toBe('等待远程结果');
  });
});
