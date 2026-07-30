import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Archive, FolderPlus, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { DesktopSession, DesktopWorkspace } from '../../../shared/contracts';
import { filterSessions } from './session-presentation';
import { WorkspaceDialogs } from './WorkspaceDialogs';
import { WorkspaceGroup, type WorkspacePageState } from './WorkspaceGroup';

interface WorkspaceSidebarProps {
  connected: boolean;
  workspaces: DesktopWorkspace[];
  sessions: DesktopSession[];
  selectedSessionId?: string;
  workspacePages: Record<string, WorkspacePageState>;
  onSelectTask(sessionId: string): void;
  onNewTask(workspaceId?: string): void;
  onAddExisting(): Promise<void>;
  onCreateWorkspace(name: string): Promise<boolean>;
  onRenameWorkspace(workspaceId: string, name: string): Promise<boolean>;
  onRemoveWorkspace(workspaceId: string): Promise<boolean>;
  onRevealWorkspace(root: string): void;
  onRenameTask(sessionId: string, title: string): void;
  onArchiveTask(session: DesktopSession): void;
  onOpenArchived(): void;
  onLoadMore(workspaceId: string): void;
}

const COLLAPSED_KEY = 'kimi-desktop:collapsed-workspaces:v1';

function readCollapsed(): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export function WorkspaceSidebar({ connected, workspaces, sessions, selectedSessionId, workspacePages, onSelectTask, onNewTask, onAddExisting, onCreateWorkspace, onRenameWorkspace, onRemoveWorkspace, onRevealWorkspace, onRenameTask, onArchiveTask, onOpenArchived, onLoadMore }: WorkspaceSidebarProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DesktopWorkspace>();
  const [removeTarget, setRemoveTarget] = useState<DesktopWorkspace>();
  const filtered = useMemo(() => filterSessions(sessions, query), [query, sessions]);
  const groups = workspaces.map((workspace) => ({
    workspace,
    sessions: filtered.filter((session) => session.workspaceId === workspace.id || (session.workspaceId === undefined && session.cwd === workspace.root)),
  })).filter((group) => !query || group.sessions.length > 0 || `${group.workspace.name} ${group.workspace.root}`.toLocaleLowerCase('zh-CN').includes(query.toLocaleLowerCase('zh-CN')));

  const toggle = (workspaceId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(workspaceId)) next.delete(workspaceId); else next.add(workspaceId);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <>
      <div className="project-sidebar-actions">
        <button type="button" className="project-sidebar-action project-sidebar-action--primary" disabled={!connected} onClick={() => onNewTask()}><Plus size={15} />新建任务</button>
        <button type="button" className="project-sidebar-action" aria-label="查看已归档任务" onClick={onOpenArchived}><Archive size={14} />已归档</button>
      </div>
      <div className="project-sidebar-heading">
        <span>项目</span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button type="button" className="icon-button" aria-label="添加工作区" disabled={!connected}><MoreHorizontal size={16} /></button></DropdownMenu.Trigger>
          <DropdownMenu.Portal><DropdownMenu.Content className="workspace-menu" sideOffset={5} align="end">
            <DropdownMenu.Item onSelect={() => void onAddExisting()}><FolderPlus size={14} />添加现有文件夹</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => setCreateOpen(true)}><Plus size={14} />创建新工作区</DropdownMenu.Item>
          </DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <label className="project-search"><Search size={14} /><input type="search" aria-label="搜索任务" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目和任务" />{query ? <button type="button" aria-label="清除搜索" onClick={() => setQuery('')}><X size={13} /></button> : null}</label>
      <div className="project-list">
        {groups.map(({ workspace, sessions: groupSessions }) => {
          const basePage = workspacePages[workspace.id];
          const page = { loading: basePage?.loading ?? false, error: basePage?.error, hasMore: basePage?.hasMore ?? workspace.sessionCount > groupSessions.length };
          return <WorkspaceGroup key={workspace.id} workspace={workspace} sessions={groupSessions} selectedSessionId={selectedSessionId} collapsed={collapsed.has(workspace.id)} page={page} onToggle={() => toggle(workspace.id)} onSelectTask={onSelectTask} onNewTask={() => onNewTask(workspace.id)} onRenameWorkspace={() => setRenameTarget(workspace)} onRemoveWorkspace={() => setRemoveTarget(workspace)} onRevealWorkspace={() => onRevealWorkspace(workspace.root)} onRenameTask={onRenameTask} onArchiveTask={onArchiveTask} onLoadMore={() => onLoadMore(workspace.id)} />;
        })}
        {groups.length === 0 ? <div className="project-list__empty"><FolderPlus size={19} /><span>{query ? '没有匹配的任务' : '还没有工作区'}</span><button type="button" onClick={() => void onAddExisting()}>{query ? '清除搜索后重试' : '添加本机文件夹'}</button></div> : null}
      </div>
      <WorkspaceDialogs createOpen={createOpen} renameTarget={renameTarget} removeTarget={removeTarget} onCreateOpenChange={setCreateOpen} onRenameClose={() => setRenameTarget(undefined)} onRemoveClose={() => setRemoveTarget(undefined)} onCreate={onCreateWorkspace} onRename={onRenameWorkspace} onRemove={onRemoveWorkspace} />
    </>
  );
}

