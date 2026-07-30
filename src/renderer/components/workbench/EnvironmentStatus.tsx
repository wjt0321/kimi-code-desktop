import { CheckCircle2, CircleAlert, CircleDashed, CircleDot, LoaderCircle, Play, ShieldAlert, Wrench } from 'lucide-react';

import type { WorkbenchStatusAction, WorkbenchStatusItem, WorkbenchStatusSummary } from './workbench-status';

interface EnvironmentStatusProps {
  summary: WorkbenchStatusSummary;
  onStart(): void;
  onChooseCli(): void;
  onOpenContext(): void;
}

const iconByTone = {
  neutral: CircleDot,
  ready: CheckCircle2,
  running: LoaderCircle,
  attention: ShieldAlert,
  error: CircleAlert,
} as const;

export function EnvironmentStatus({ summary, onStart, onChooseCli, onOpenContext }: EnvironmentStatusProps) {
  return (
    <section className="environment-status" aria-label="本地环境状态" role="status" aria-live="polite">
      <header><span>本地环境</span><CircleDashed size={14} /></header>
      <StatusRow kind="CLI" item={summary.cli} onStart={onStart} onChooseCli={onChooseCli} onOpenContext={onOpenContext} />
      <StatusRow kind="服务" item={summary.service} onStart={onStart} onChooseCli={onChooseCli} onOpenContext={onOpenContext} />
      <StatusRow kind="任务" item={summary.task} onStart={onStart} onChooseCli={onChooseCli} onOpenContext={onOpenContext} />
    </section>
  );
}

function StatusRow({ kind, item, onStart, onChooseCli, onOpenContext }: {
  kind: string;
  item: WorkbenchStatusItem;
  onStart(): void;
  onChooseCli(): void;
  onOpenContext(): void;
}) {
  const Icon = iconByTone[item.tone];
  return (
    <div className={`environment-status__row environment-status__row--${item.tone}`}>
      <span className="environment-status__icon"><Icon size={15} /></span>
      <div><small>{kind}</small><strong>{item.label}</strong><p>{item.detail}</p></div>
      <StatusAction action={item.action} onStart={onStart} onChooseCli={onChooseCli} onOpenContext={onOpenContext} />
    </div>
  );
}

function StatusAction({ action, onStart, onChooseCli, onOpenContext }: {
  action: WorkbenchStatusAction | undefined;
  onStart(): void;
  onChooseCli(): void;
  onOpenContext(): void;
}) {
  if (action === 'start-service' || action === 'retry-service') return <button type="button" className="status-action" onClick={onStart}><Play size={13} />启动本地服务</button>;
  if (action === 'choose-cli') return <button type="button" className="status-action" onClick={onChooseCli}><Wrench size={13} />选择 CLI 文件</button>;
  if (action === 'open-context') return <button type="button" className="status-action" onClick={onOpenContext}>处理待处理项</button>;
  return null;
}
