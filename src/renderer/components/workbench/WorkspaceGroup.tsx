import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Archive, ChevronRight, CircleDot, Folder, FolderOpen, LoaderCircle, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { DesktopSession, DesktopWorkspace } from '../../../shared/contracts';
import { formatSessionTime, sessionPresentation } from './session-presentation';

export interface WorkspacePageState {
  loading: boolean;
  hasMore: boolean;
  error?: string;
}

interface WorkspaceGroupProps {
  workspace: DesktopWorkspace;
  sessions: DesktopSession[];
  selectedSessionId?: string;
  collapsed: boolean;
  page?: WorkspacePageState;
  onToggle(): void;
  onSelectTask(sessionId: string): void;
  onNewTask(): void;
  onRenameWorkspace(): void;
  onRemoveWorkspace(): void;
  onRevealWorkspace(): void;
  onRenameTask(sessionId: string, title: string): void;
  onArchiveTask(session: DesktopSession): void;
  onLoadMore(): void;
}

export function WorkspaceGroup({ workspace, sessions, selectedSessionId, collapsed, page, onToggle, onSelectTask, onNewTask, onRenameWorkspace, onRemoveWorkspace, onRevealWorkspace, onRenameTask, onArchiveTask, onLoadMore }: WorkspaceGroupProps) {
  const [renamingId, setRenamingId] = useState<string>();
  const [renameValue, setRenameValue] = useState('');
  const commitRename = () => {
    const title = renameValue.trim();
    if (renamingId && title) onRenameTask(renamingId, title);
    setRenamingId(undefined);
  };

  return (
    <section className={`workspace-group ${collapsed ? 'workspace-group--collapsed' : ''}`} aria-label={`工作区 ${workspace.name}`}>
      <div className="workspace-group__header">
        <button type="button" className="workspace-group__toggle" aria-expanded={!collapsed} onClick={onToggle} title={workspace.root}>
          <ChevronRight size={14} />
          <Folder size={15} />
          <span><strong>{workspace.name}</strong><small>{workspace.root}</small></span>
          <em>{workspace.sessionCount}</em>
        </button>
        <button type="button" className="workspace-group__quick" aria-label={`在“${workspace.name}”中新建任务`} onClick={onNewTask}><Plus size={14} /></button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button type="button" className="workspace-group__quick" aria-label={`“${workspace.name}”工作区菜单`}><MoreHorizontal size={15} /></button></DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="workspace-menu" sideOffset={5} align="end">
              <DropdownMenu.Item onSelect={onRevealWorkspace}><FolderOpen size={14} />在资源管理器中打开</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={onRenameWorkspace}><Pencil size={14} />重命名显示名称</DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item className="workspace-menu__danger" onSelect={onRemoveWorkspace}><Trash2 size={14} />从列表清除</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {!collapsed ? (
        <div className="workspace-group__tasks">
          {sessions.map((session) => {
            const active = session.id === selectedSessionId;
            const presentation = sessionPresentation(session);
            return (
              <article key={session.id} className={`workspace-task ${active ? 'workspace-task--active' : ''}`}>
                {renamingId === session.id ? (
                  <form className="workspace-task__rename" onSubmit={(event) => { event.preventDefault(); commitRename(); }}>
                    <input autoFocus aria-label="新的任务标题" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={commitRename} onKeyDown={(event) => { if (event.key === 'Escape') setRenamingId(undefined); }} />
                  </form>
                ) : (
                  <button type="button" className="workspace-task__main" aria-current={active ? 'page' : undefined} onClick={() => onSelectTask(session.id)}>
                    <span className={`workspace-task__state workspace-task__state--${presentation.tone}`}>{session.busy ? <LoaderCircle size={11} className="spin" /> : <CircleDot size={11} />}</span>
                    <span><strong>{session.title || '未命名任务'}</strong><small>{session.lastPrompt || session.cwd || '等待第一条请求'}</small></span>
                    <span className={`workspace-task__badge workspace-task__badge--${presentation.tone}`}>{presentation.label}</span><time>{formatSessionTime(session.updatedAt)}</time>
                  </button>
                )}
                <div className="workspace-task__actions">
                  <button type="button" aria-label="重命名任务" onClick={() => { setRenamingId(session.id); setRenameValue(session.title); }}><Pencil size={12} /></button>
                  <button type="button" aria-label="归档任务" onClick={() => onArchiveTask(session)}><Archive size={12} /></button>
                </div>
              </article>
            );
          })}
          {sessions.length === 0 && !page?.loading ? <div className="workspace-group__empty"><span>还没有任务</span><button type="button" onClick={onNewTask}>创建第一个任务</button></div> : null}
          {page?.loading ? <div className="workspace-group__loading"><LoaderCircle size={13} className="spin" />正在加载任务…</div> : null}
          {page?.error ? <button type="button" className="workspace-group__more workspace-group__more--error" onClick={onLoadMore}>{page.error} 点击重试</button> : null}
          {!page?.loading && !page?.error && page?.hasMore ? <button type="button" className="workspace-group__more" onClick={onLoadMore}>显示更多任务</button> : null}
        </div>
      ) : null}
    </section>
  );
}
