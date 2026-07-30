import {
  Bot, CheckCircle2, ChevronRight, CircleAlert, CircleEllipsis, FileCode2, FilePenLine,
  FileSearch, FileText, Globe2, ListChecks, LoaderCircle, Search, SquareTerminal, Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import type { DesktopDiffTarget, DesktopTimelineToolEntry } from '../../../shared/contracts';
import { StructuredValue } from './StructuredValue';

interface ToolCallCardProps {
  entry: DesktopTimelineToolEntry;
  onOpenDiff(target: DesktopDiffTarget): void;
  onOpenTask(taskId: string): void;
}

export function ToolCallCard({ entry, onOpenDiff, onOpenTask }: ToolCallCardProps) {
  const title = entry.title ?? entry.name;
  const [open, setOpen] = useState(entry.state !== 'done');
  const Icon = categoryIcon(entry.category);
  const status = statusPresentation(entry.state);
  const hasDetails = Boolean(entry.command || entry.cwd || entry.path || entry.query || entry.input || entry.output || entry.error || entry.progress || entry.diff || entry.taskId || entry.agentRefs?.length);

  return (
    <article className={`execution-card execution-card--${entry.state}`} data-tool-call-id={entry.toolCallId}>
      <button
        type="button"
        className="execution-card__summary"
        aria-expanded={open}
        aria-label={`${open ? '收起' : '展开'}${title}详情`}
        onClick={() => hasDetails && setOpen((value) => !value)}
      >
        <span className="execution-card__icon"><Icon size={15} /></span>
        <span className="execution-card__identity">
          <span className="execution-card__eyebrow">{toolKindLabel(entry.category)}</span>
          <strong>{title}</strong>
          <code>{entry.summary}</code>
        </span>
        <span className={`execution-card__status execution-card__status--${entry.state}`}>
          <status.Icon size={13} className={entry.state === 'running' ? 'spin' : undefined} />
          {status.label}
        </span>
        {hasDetails ? <ChevronRight size={14} className={`execution-card__chevron ${open ? 'is-open' : ''}`} /> : null}
      </button>

      {entry.progress ? (
        <div className={`execution-progress execution-progress--${entry.progress.kind}`}>
          <div className="execution-progress__copy">
            <span>{entry.progress.text ?? progressLabel(entry.progress.kind)}</span>
            {entry.progress.percent !== undefined ? <strong>{Math.round(entry.progress.percent)}%</strong> : null}
          </div>
          {entry.progress.percent !== undefined ? <div className="execution-progress__track"><span style={{ width: `${entry.progress.percent}%` }} /></div> : null}
        </div>
      ) : null}

      {open && hasDetails ? (
        <div className="execution-card__details">
          <div className="execution-card__facts">
            {entry.command ? <ExecutionFact label="命令" value={entry.command} code /> : null}
            {entry.cwd ? <ExecutionFact label="工作目录" value={entry.cwd} code /> : null}
            {entry.path ? <ExecutionFact label="文件" value={entry.path} code /> : null}
            {entry.query ? <ExecutionFact label="查询" value={entry.query} code /> : null}
          </div>
          {entry.input ? <ExecutionSection title="输入"><StructuredValue value={entry.input} /></ExecutionSection> : null}
          {entry.output ? <ExecutionSection title="输出"><StructuredValue value={entry.output} /></ExecutionSection> : null}
          {entry.error ? <div className="execution-card__error"><CircleAlert size={14} /><pre>{entry.error}</pre></div> : null}
          {entry.agentRefs?.length ? <div className="execution-agent-refs">{entry.agentRefs.map((agent) => <span key={`${agent.agentId}:${agent.role ?? ''}`}><strong>{agent.role === 'child' ? '子 Agent' : agent.role === 'member' ? 'Agent 成员' : 'Agent'}</strong><code>{agent.agentId}</code></span>)}</div> : null}
          {entry.diff || entry.taskId ? (
            <div className="execution-card__actions">
              {entry.diff ? <button type="button" className="execution-action" onClick={() => onOpenDiff(entry.diff!)}><FileCode2 size={14} />查看完整差异</button> : null}
              {entry.taskId ? <button type="button" className="execution-action" onClick={() => onOpenTask(entry.taskId!)}><Workflow size={14} />查看后台任务</button> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ExecutionFact({ label, value, code = false }: { label: string; value: string; code?: boolean }) {
  return <div className="execution-fact"><span>{label}</span>{code ? <code>{value}</code> : <strong>{value}</strong>}</div>;
}

function ExecutionSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="execution-section"><h3>{title}</h3>{children}</section>;
}

function categoryIcon(category: DesktopTimelineToolEntry['category']): LucideIcon {
  const icons: Record<NonNullable<DesktopTimelineToolEntry['category']>, LucideIcon> = {
    shell: SquareTerminal,
    read: FileText,
    write: FilePenLine,
    edit: FileCode2,
    search: Search,
    web: Globe2,
    agent: Bot,
    task: Workflow,
    todo: ListChecks,
    generic: CircleEllipsis,
  };
  return icons[category ?? 'generic'] ?? FileSearch;
}

function toolKindLabel(category: DesktopTimelineToolEntry['category']): string {
  const labels: Record<NonNullable<DesktopTimelineToolEntry['category']>, string> = {
    shell: '终端', read: '文件读取', write: '文件写入', edit: '代码变更', search: '本地搜索',
    web: '网络访问', agent: '子 Agent', task: '后台任务', todo: '任务计划', generic: '工具调用',
  };
  return labels[category ?? 'generic'];
}

function statusPresentation(state: DesktopTimelineToolEntry['state']): { label: string; Icon: LucideIcon } {
  if (state === 'running') return { label: '运行中', Icon: LoaderCircle };
  if (state === 'done') return { label: '已完成', Icon: CheckCircle2 };
  return { label: '失败', Icon: CircleAlert };
}

function progressLabel(kind: string): string {
  if (kind === 'stdout') return '正在输出结果';
  if (kind === 'stderr') return '工具返回了错误输出';
  return '正在更新执行进度';
}
