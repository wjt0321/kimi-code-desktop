import { AlertTriangle, Bot, CheckCircle2, Clock3, LoaderCircle, SquareTerminal, Wrench, X } from 'lucide-react';

import type { DesktopTask } from '../../../shared/contracts';
import { presentBackgroundTask } from './background-task-presentation';

interface BackgroundTaskPanelProps {
  task: DesktopTask;
  onClose(): void;
}

export function BackgroundTaskPanel({ task, onClose }: BackgroundTaskPanelProps) {
  const presentation = presentBackgroundTask(task);
  const Icon = presentation.spinning ? LoaderCircle : task.kind === 'subagent' ? Bot : task.kind === 'shell' ? SquareTerminal : Wrench;
  const latestTime = task.updatedAt ?? task.endedAt ?? task.startedAt;

  return (
    <aside className="workbench-context background-task-panel" aria-label="后台任务详情">
      <header className="background-task-panel__header">
        <div className="background-task-panel__identity">
          <span className={`background-task-panel__icon background-task-panel__icon--${presentation.tone}`}><Icon size={15} className={presentation.spinning ? 'spin' : undefined} /></span>
          <div><h2>{task.title}</h2><p>{presentation.kindLabel}</p></div>
        </div>
        <button type="button" className="icon-button" aria-label="关闭后台任务详情" onClick={onClose}><X size={14} /></button>
      </header>
      <div className="background-task-panel__meta">
        <span className={`background-task-state background-task-state--${presentation.tone}`}>{presentation.stateLabel}</span>
        {task.startedAt ? <span><Clock3 size={12} />开始于 {formatTaskTime(task.startedAt)}</span> : null}
        {task.endedAt ? <span><CheckCircle2 size={12} />结束于 {formatTaskTime(task.endedAt)}</span> : latestTime ? <span><Clock3 size={12} />最近更新 {formatTaskTime(latestTime)}</span> : null}
      </div>
      <div className="background-task-panel__body">
        <p className={`background-task-detail background-task-detail--${presentation.tone}`}>{presentation.detail}</p>
        {task.error ? <div className="background-task-error" role="alert"><AlertTriangle size={14} /><pre>{task.error}</pre></div> : null}
        {task.resultSummary ? <section className="background-task-output"><h3>结果摘要</h3><pre>{task.resultSummary}</pre></section> : null}
        <section className="background-task-output">
          <h3>输出尾部</h3>
          {task.outputTail ? <pre>{task.outputTail}</pre> : <div className="background-task-empty">当前还没有可显示的输出。</div>}
        </section>
      </div>
    </aside>
  );
}

function formatTaskTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}
