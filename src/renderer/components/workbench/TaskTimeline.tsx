import { Bot, Brain, ChevronRight, CircleAlert, LoaderCircle, User } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { DesktopDiffTarget, DesktopTaskSnapshot, DesktopTimelineEntry } from '../../../shared/contracts';
import { RichText } from './RichText';
import { ToolCallCard } from './ToolCallCard';

interface TaskTimelineProps {
  snapshot: DesktopTaskSnapshot | undefined;
  loading: boolean;
  onOpenDiff?(target: DesktopDiffTarget): void;
  onOpenTask?(taskId: string): void;
}

export function TaskTimeline({ snapshot, loading, onOpenDiff = () => undefined, onOpenTask = () => undefined }: TaskTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const entryCount = snapshot?.timeline.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entryCount]);

  if (loading && !snapshot) return <TimelineLoading />;
  if (!snapshot || snapshot.timeline.length === 0) {
    return (
      <div className="timeline-empty">
        <div className="timeline-empty__mark"><Bot size={20} /></div>
        <strong>准备好了</strong>
        <span>在下方描述任务，执行过程和结果会实时显示在这里。</span>
      </div>
    );
  }

  return (
    <div className="task-timeline" aria-live="polite">
      <div className="task-timeline__inner">
        {snapshot.timeline.map((entry) => <TimelineEntry key={entry.id} entry={entry} onOpenDiff={onOpenDiff} onOpenTask={onOpenTask} />)}
        {snapshot.status.phase === 'running' || snapshot.status.phase === 'streaming' || snapshot.status.phase === 'tool' ? (
          <div className="timeline-running"><LoaderCircle size={14} /><span>{runningLabel(snapshot.status.phase)}</span></div>
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function TimelineEntry({ entry, onOpenDiff, onOpenTask }: {
  entry: DesktopTimelineEntry;
  onOpenDiff(target: DesktopDiffTarget): void;
  onOpenTask(taskId: string): void;
}) {
  if (entry.kind === 'text') {
    if (entry.role === 'user') {
      return (
        <article className="message message--user">
          <div className="message-avatar"><User size={14} /></div>
          <div className="message-body"><div className="message-label">你</div><RichText text={entry.text} /></div>
        </article>
      );
    }
    return (
      <article className={`message message--assistant ${entry.state === 'streaming' ? 'is-streaming' : ''}`}>
        <div className="message-avatar"><Bot size={15} /></div>
        <div className="message-body"><div className="message-label">Kimi Code{entry.state === 'streaming' ? <span>正在回复</span> : null}</div><RichText text={entry.text} /></div>
      </article>
    );
  }

  if (entry.kind === 'thinking') {
    return (
      <details className="thinking-block" open={entry.state === 'streaming'}>
        <summary><span className="thinking-block__icon"><Brain size={14} /></span><span>{entry.state === 'streaming' ? '正在思考' : '思考过程'}</span>{entry.state === 'streaming' ? <LoaderCircle size={13} className="spin" /> : <ChevronRight size={13} className="details-chevron" />}</summary>
        <div className="thinking-block__content"><RichText text={entry.text} /></div>
      </details>
    );
  }

  if (entry.kind === 'tool') return <ToolCallCard entry={entry} onOpenDiff={onOpenDiff} onOpenTask={onOpenTask} />;

  return <div className={`timeline-notice timeline-notice--${entry.level}`}><CircleAlert size={14} /><span>{entry.text}</span></div>;
}

function TimelineLoading() {
  return <div className="timeline-loading"><div /><div /><div /><span>正在同步任务记录…</span></div>;
}

function runningLabel(phase: string): string {
  if (phase === 'tool') return 'Kimi Code 正在使用工具';
  if (phase === 'streaming') return 'Kimi Code 正在生成回复';
  return 'Kimi Code 正在处理任务';
}
