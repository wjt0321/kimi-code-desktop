import {
  AlertTriangle, Bot, Check, FileCode2, FileText, Globe2, ListChecks, LoaderCircle,
  Search, ShieldAlert, SquareTerminal, Workflow, X,
} from 'lucide-react';
import { useState } from 'react';

import type { DesktopApproval, DesktopApprovalBlock } from '../../../shared/contracts';
import { RichText } from './RichText';

interface InlineApprovalCardProps {
  approval: DesktopApproval;
  pending: boolean;
  onDecision(decision: 'approved' | 'rejected', feedback?: string, selectedLabel?: string): Promise<boolean> | boolean;
}

export function InlineApprovalCard({ approval, pending, onDecision }: InlineApprovalCardProps) {
  const [feedback, setFeedback] = useState('');
  const normalizedFeedback = feedback.trim() || undefined;

  const submit = async (decision: 'approved' | 'rejected', selectedLabel?: string) => {
    const accepted = await onDecision(decision, normalizedFeedback, selectedLabel);
    if (accepted) setFeedback('');
  };

  return (
    <article id={`approval-${approval.id}`} className="inline-approval" tabIndex={-1} aria-label={`待审批：${approval.action}`}>
      <header className="inline-approval__header">
        <span className="inline-approval__icon"><ShieldAlert size={15} /></span>
        <div><span>需要你的确认</span><strong>{approval.action || approval.toolName}</strong></div>
        <span className="inline-approval__tool">{approval.toolName}</span>
      </header>

      <div className="inline-approval__body">
        {approval.block ? <ApprovalBlockView block={approval.block} /> : <pre className="approval-generic">{approval.summary}</pre>}
        {approval.summary && approval.block?.kind !== 'generic' ? <p className="inline-approval__summary">{approval.summary}</p> : null}
        <label className="approval-feedback">
          <span>反馈（可选）</span>
          <textarea aria-label="审批反馈" disabled={pending} value={feedback} rows={2} placeholder="补充说明、修改要求或拒绝原因…" onChange={(event) => setFeedback(event.target.value)} />
        </label>
      </div>

      <footer className="inline-approval__actions">
        {approval.block?.kind === 'plan_review' && approval.block.options?.length ? (
          <div className="plan-review-options">
            {approval.block.options.map((option) => (
              <button key={option.label} type="button" className="approval-option" disabled={pending} onClick={() => void submit('approved', option.label)}>
                <Check size={13} /><span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="button approval-approve" aria-label={pending ? '正在提交审批' : '允许一次'} disabled={pending} onClick={() => void submit('approved')}>
            {pending ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}{pending ? '正在提交' : '允许一次'}
          </button>
        )}
        <button type="button" className="button button--secondary approval-reject" disabled={pending} onClick={() => void submit('rejected')}><X size={14} />拒绝</button>
      </footer>
    </article>
  );
}

function ApprovalBlockView({ block }: { block: DesktopApprovalBlock }) {
  if (block.kind === 'shell') {
    return <section className="approval-command"><BlockTitle icon={SquareTerminal} label="将运行命令" />{block.danger ? <div className="approval-danger"><AlertTriangle size={13} />{block.danger}</div> : null}<pre>{block.command}</pre>{block.cwd ? <BlockFact label="工作目录" value={block.cwd} /> : null}</section>;
  }
  if (block.kind === 'diff') {
    return <section><BlockTitle icon={FileCode2} label="将修改文件" /><BlockFact label="文件" value={block.path} /><div className="approval-diff-preview">{block.diff.slice(0, 12).map((line, index) => <code key={`${index}:${line.type}`} className={`approval-diff-line approval-diff-line--${line.type}`}>{line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}{line.text}</code>)}</div>{block.diff.length > 12 ? <span className="approval-more">另有 {block.diff.length - 12} 行未展开</span> : null}</section>;
  }
  if (block.kind === 'file') {
    return <section><BlockTitle icon={FileText} label="将写入文件" /><BlockFact label="文件" value={block.path} /><pre className="approval-file-preview">{block.content}</pre></section>;
  }
  if (block.kind === 'fileop') {
    return <section><BlockTitle icon={FileText} label={block.op} /><BlockFact label="文件" value={block.path} />{block.detail ? <p>{block.detail}</p> : null}</section>;
  }
  if (block.kind === 'url') {
    return <section><BlockTitle icon={Globe2} label="将访问网络" /><BlockFact label={block.method ?? 'URL'} value={block.url} /></section>;
  }
  if (block.kind === 'search') {
    return <section><BlockTitle icon={Search} label="将搜索内容" /><BlockFact label="查询" value={block.query} />{block.scope ? <BlockFact label="范围" value={block.scope} /> : null}</section>;
  }
  if (block.kind === 'invocation') {
    return <section><BlockTitle icon={block.kind2.includes('agent') ? Bot : Workflow} label={block.kind2} /><BlockFact label="目标" value={block.name} />{block.description ? <p>{block.description}</p> : null}</section>;
  }
  if (block.kind === 'todo') {
    return <section><BlockTitle icon={ListChecks} label="将更新待办" /><div className="approval-todos">{block.items.map((item, index) => <div key={`${index}:${item.title}`}><span>{item.status}</span><strong>{item.title}</strong></div>)}</div></section>;
  }
  if (block.kind === 'plan_review') {
    return <section className="approval-plan"><BlockTitle icon={Workflow} label="实施计划" />{block.path ? <BlockFact label="计划文件" value={block.path} /> : null}<div className="approval-plan__content"><RichText text={block.plan} /></div></section>;
  }
  return <pre className="approval-generic">{block.summary}</pre>;
}

function BlockTitle({ icon: Icon, label }: { icon: typeof SquareTerminal; label: string }) {
  return <h3 className="approval-block-title"><Icon size={13} />{label}</h3>;
}

function BlockFact({ label, value }: { label: string; value: string }) {
  return <div className="approval-block-fact"><span>{label}</span><code>{value}</code></div>;
}
