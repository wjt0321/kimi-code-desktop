import { Copy, FileCode2, FolderOpen, TriangleAlert, X } from 'lucide-react';

import type { DesktopDiffTarget } from '../../../shared/contracts';

interface DiffReviewPanelProps {
  target: DesktopDiffTarget;
  onClose(): void;
  onCopyPath(path: string): void;
  onCopyDiff(text: string): void;
  onRevealPath(path: string): void;
}

export function DiffReviewPanel({ target, onClose, onCopyPath, onCopyDiff, onRevealPath }: DiffReviewPanelProps) {
  const additions = target.lines.filter((line) => line.type === 'add').length;
  const deletions = target.lines.filter((line) => line.type === 'del').length;
  const unifiedText = toUnifiedText(target);

  return (
    <aside className="workbench-context diff-review" aria-label="文件差异审阅">
      <header className="diff-review__header">
        <div className="diff-review__identity">
          <span className="diff-review__icon"><FileCode2 size={15} /></span>
          <div>
            <h2>{target.title}</h2>
            {target.path ? <p title={target.path}>{target.path}</p> : null}
          </div>
        </div>
        <button type="button" className="icon-button" aria-label="关闭差异审阅" onClick={onClose}><X size={14} /></button>
      </header>

      <div className="diff-review__summary">
        <div className="diff-review__stats" aria-label="差异统计">
          <span className="diff-stat diff-stat--add">+{additions}</span>
          <span className="diff-stat diff-stat--del">-{deletions}</span>
          <span>{target.lines.length} 行</span>
        </div>
        <div className="diff-review__actions">
          {target.path ? <button type="button" className="execution-action" onClick={() => onCopyPath(target.path!)}><Copy size={12} />复制文件路径</button> : null}
          {unifiedText ? <button type="button" className="execution-action" onClick={() => onCopyDiff(unifiedText)}><Copy size={12} />复制差异</button> : null}
          {target.path ? <button type="button" className="execution-action" onClick={() => onRevealPath(target.path!)}><FolderOpen size={12} />在资源管理器中显示</button> : null}
        </div>
      </div>

      {target.truncated ? <div className="diff-review__warning"><TriangleAlert size={13} /><span>差异过大，已显示工具输出</span></div> : null}

      <div className="diff-review__body">
        {target.lines.length > 0 ? (
          <div className="diff-view" role="table" aria-label={`${target.title} 文件差异`}>
            {target.lines.map((line, index) => (
              <div key={`${index}:${line.type}:${line.oldNo ?? ''}:${line.newNo ?? ''}`} className={`diff-row diff-row--${line.type}`} role="row">
                <span className="diff-row__number" aria-label={line.oldNo ? `旧文件第 ${line.oldNo} 行` : undefined}>{line.oldNo ?? ''}</span>
                <span className="diff-row__number" aria-label={line.newNo ? `新文件第 ${line.newNo} 行` : undefined}>{line.newNo ?? ''}</span>
                <span className="diff-row__prefix" aria-hidden="true">{linePrefix(line.type)}</span>
                <code>{line.text}</code>
              </div>
            ))}
          </div>
        ) : target.fallbackOutput ? <pre className="diff-review__fallback">{target.fallbackOutput}</pre> : <div className="diff-review__empty">没有可显示的逐行差异。</div>}
      </div>
    </aside>
  );
}

function linePrefix(type: DesktopDiffTarget['lines'][number]['type']): string {
  if (type === 'add') return '+';
  if (type === 'del') return '-';
  return type === 'hunk' ? '@' : ' ';
}

function toUnifiedText(target: DesktopDiffTarget): string {
  const header = target.path ? `--- ${target.path}\n+++ ${target.path}` : `--- ${target.title}\n+++ ${target.title}`;
  if (target.lines.length === 0) return target.fallbackOutput ?? '';
  return `${header}\n${target.lines.map((line) => `${linePrefix(line.type)}${line.text}`).join('\n')}`;
}
