import type { DesktopTask } from '../../../shared/contracts';

export type BackgroundTaskTone = 'running' | 'progress' | 'waiting' | 'completed' | 'failed' | 'cancelled' | 'unknown';

export interface BackgroundTaskPresentation {
  kindLabel: string;
  stateLabel: string;
  detail: string;
  tone: BackgroundTaskTone;
  spinning: boolean;
}

export function presentBackgroundTask(task: DesktopTask): BackgroundTaskPresentation {
  const kindLabel = {
    shell: '后台命令',
    subagent: '子 Agent',
    tool: '工具任务',
    other: '后台任务',
  }[task.kind];

  if (task.state === 'completed') return terminal(task, kindLabel, '已完成', 'completed', '任务已经完成。');
  if (task.state === 'failed') return terminal(task, kindLabel, '失败', 'failed', '任务执行失败。');
  if (task.state === 'timed_out') return terminal(task, kindLabel, '已超时', 'failed', '任务超过等待时间。');
  if (task.state === 'killed') return terminal(task, kindLabel, '已取消', 'cancelled', '任务已经取消。');
  if (task.state === 'lost') return terminal(task, kindLabel, '状态未知', 'unknown', '暂时无法确认任务终态。');

  if (task.activityHint === 'waiting_notification') {
    return {
      kindLabel,
      stateLabel: '等待完成通知',
      detail: task.stateReason ?? '已取得当前快照，任务完成后会自动更新。',
      tone: 'waiting',
      spinning: true,
    };
  }
  if (task.activityHint === 'snapshot' || task.outputTail.trim().length > 0) {
    return {
      kindLabel,
      stateLabel: '已有进展',
      detail: task.stateReason ?? '已收到新的输出快照，任务仍在继续。',
      tone: 'progress',
      spinning: false,
    };
  }
  return {
    kindLabel,
    stateLabel: '运行中',
    detail: task.stateReason ?? '后台任务正在运行。',
    tone: 'running',
    spinning: true,
  };
}

function terminal(
  task: DesktopTask,
  kindLabel: string,
  stateLabel: string,
  tone: Exclude<BackgroundTaskTone, 'running' | 'progress' | 'waiting'>,
  fallback: string,
): BackgroundTaskPresentation {
  return {
    kindLabel,
    stateLabel,
    detail: task.resultSummary ?? task.stateReason ?? task.error ?? fallback,
    tone,
    spinning: false,
  };
}
