import { AlertTriangle, Bot, CheckCircle2, Clock3, LoaderCircle, SquareTerminal, Wrench, X } from 'lucide-react';

import type { DesktopTask } from '../../../shared/contracts';

interface BackgroundTaskPanelProps {
  task: DesktopTask;
  onClose(): void;
}

export function BackgroundTaskPanel({ task, onClose }: BackgroundTaskPanelProps) {
  const presentation = taskPresentation(task);
  const Icon = presentation.icon;

  return (
    <aside className="workbench-context background-task-panel" aria-label="后台任务详情">
      <header className="background-task-panel__header">
        <div className="background-task-panel__identity">
          <span className={`background-task-panel__icon background-task-panel__icon--${task.state}`}><Icon size={15} className={task.state === 'running' ? 'spin' : undefined} /></span>
          <div><h2>{task.title}</h2><p>{presentation.kind}</p></div>
        </div>
        <button type="button" className="icon-button" aria-label="关闭后台任务详情" onClick={onClose}><X size={14} /></button>
      </header>
      <div className="background-task-panel__meta">
        <span className={`background-task-state background-task-state--${task.state}`}>{presentation.state}</span>
        {task.startedAt ? <span><Clock3 size={12} />开始于 {formatTaskTime(task.startedAt)}</span> : null}
        {task.endedAt ? <span><CheckCircle2 size={12} />结束于 {formatTaskTime(task.endedAt)}</span> : null}
      </div>
      <div className="background-task-panel__body">
        {task.error ? <div className="background-task-error" role="alert"><AlertTriangle size={14} /><pre>{task.error}</pre></div> : null}
        <section className="background-task-output">
          <h3>输出尾部</h3>
          {task.outputTail ? <pre>{task.outputTail}</pre> : <div className="background-task-empty">当前还没有可显示的输出。</div>}
        </section>
      </div>
    </aside>
  );
}

function taskPresentation(task: DesktopTask): { kind: string; state: string; icon: typeof Bot } {
  const kind = { shell: '后台命令', subagent: '子 Agent', tool: '工具任务', other: '后台任务' }[task.kind];
  const state = { running: '运行中', completed: '已完成', failed: '失败', timed_out: '已超时', killed: '已终止', lost: '已失联' }[task.state];
  const icon = task.state === 'running' ? LoaderCircle : task.kind === 'subagent' ? Bot : task.kind === 'shell' ? SquareTerminal : Wrench;
  return { kind, state, icon };
}

function formatTaskTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}
