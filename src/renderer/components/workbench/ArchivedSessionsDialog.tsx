import * as Dialog from '@radix-ui/react-dialog';
import { ArchiveRestore, Clock3, LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DesktopSession } from '../../../shared/contracts';
import { formatSessionTime } from './session-presentation';

interface ArchivedSessionsDialogProps {
  open: boolean;
  sessions: DesktopSession[];
  loading: boolean;
  onOpenChange(open: boolean): void;
  onLoad(): void;
  onRestore(sessionId: string): Promise<boolean>;
}

export function ArchivedSessionsDialog({ open, sessions, loading, onOpenChange, onLoad, onRestore }: ArchivedSessionsDialogProps) {
  const [query, setQuery] = useState('');
  const [restoringId, setRestoringId] = useState<string>();
  const filtered = sessions.filter((session) => `${session.title} ${session.lastPrompt ?? ''} ${session.cwd}`.toLocaleLowerCase('zh-CN').includes(query.trim().toLocaleLowerCase('zh-CN')));

  useEffect(() => {
    if (open) onLoad();
    else {
      setQuery('');
      setRestoringId(undefined);
    }
  }, [open, onLoad]);

  const restore = async (sessionId: string) => {
    setRestoringId(sessionId);
    try {
      if (await onRestore(sessionId)) onOpenChange(false);
    } finally {
      setRestoringId(undefined);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="archived-dialog" aria-label="已归档任务">
          <header className="dialog-heading">
            <div><p className="eyebrow">任务历史</p><Dialog.Title>已归档任务</Dialog.Title><Dialog.Description>恢复后，任务会重新出现在对应工作区并自动打开。</Dialog.Description></div>
            <Dialog.Close asChild><button type="button" className="icon-button" aria-label="关闭"><X size={16} /></button></Dialog.Close>
          </header>
          <label className="archived-dialog__search"><Search size={14} /><input type="search" aria-label="搜索已归档任务" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、路径或最近请求" /></label>
          <div className="archived-dialog__list">
            {loading ? <div className="archived-dialog__empty"><LoaderCircle size={18} className="spin" /><span>正在读取归档任务…</span></div> : null}
            {!loading && filtered.map((session) => (
              <article key={session.id} className="archived-session-row">
                <span className="archived-session-row__icon"><ArchiveRestore size={15} /></span>
                <div><strong>{session.title || '未命名任务'}</strong><span>{session.lastPrompt || session.cwd}</span><small><Clock3 size={11} />{formatSessionTime(session.updatedAt)} · {session.cwd}</small></div>
                <button type="button" className="button button--secondary" aria-label={`恢复任务“${session.title || '未命名任务'}”`} disabled={restoringId !== undefined} onClick={() => void restore(session.id)}>{restoringId === session.id ? <LoaderCircle size={13} className="spin" /> : <ArchiveRestore size={13} />}恢复</button>
              </article>
            ))}
            {!loading && filtered.length === 0 ? <div className="archived-dialog__empty"><ArchiveRestore size={20} /><span>{query ? '没有匹配的归档任务' : '暂时没有已归档任务'}</span></div> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
