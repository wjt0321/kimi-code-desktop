import * as Dialog from '@radix-ui/react-dialog';
import {
  Archive,
  Bot,
  BrainCircuit,
  ChevronDown,
  CircleDot,
  Command,
  Folder,
  FolderPlus,
  Gauge,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Pencil,
  Plus,
  Route,
  Search,
  Settings,
  Square,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { CreateTaskRequest, DesktopDiffTarget, DesktopModel, DesktopSession, DesktopSessionRuntime, DesktopStatus, DesktopTaskSnapshot, DesktopWorkspace, UpdateRuntimeRequest } from '../../../shared/contracts';
import kimiBanner from '../../assets/kimi-banner-dark.svg';
import kimiIcon from '../../assets/kimi-icon.svg';
import { ArchivedSessionsDialog } from './ArchivedSessionsDialog';
import { BackgroundTaskPanel } from './BackgroundTaskPanel';
import { ContextDock } from './ContextDock';
import { DiffReviewPanel } from './DiffReviewPanel';
import { NewTaskDialog } from './NewTaskDialog';
import { SessionActionDialogs, type SessionDialogAction } from './SessionActionDialogs';
import { SessionActionsMenu } from './SessionActionsMenu';
import { SettingsDialog } from './SettingsDialog';
import { filterSessions, formatSessionTime, sessionPresentation } from './session-presentation';
import { TaskComposer } from './TaskComposer';
import { TaskTimeline } from './TaskTimeline';
import { presentWorkbenchStatus } from './workbench-status';

interface WorkbenchShellProps {
  status: DesktopStatus;
  workspaces: DesktopWorkspace[];
  models: DesktopModel[];
  selectedModelId: string | undefined;
  selectedWorkspaceId: string | undefined;
  sessions: DesktopSession[];
  archivedSessions: DesktopSession[];
  archivedLoading: boolean;
  selectedSession: DesktopSession | undefined;
  snapshot: DesktopTaskSnapshot | undefined;
  runtime: DesktopSessionRuntime | undefined;
  runtimeLoading: boolean;
  runtimeUpdating: boolean;
  composerDraft?: { revision: number; text: string };
  loading: boolean;
  error: string | undefined;
  pendingApprovalIds: readonly string[];
  newTaskRequest?: number;
  sessionActionRequest?: { revision: number; action: SessionDialogAction };
  archivedRequest?: number;
  onStart(): void;
  onChooseCli?(): void;
  onStop(): void;
  onSelectWorkspace(workspaceId: string): void;
  onSelectTask(sessionId: string): void;
  onCreateTask(input: CreateTaskRequest): void;
  onSelectModel(modelId: string): void;
  onRuntimeChange(patch: Omit<UpdateRuntimeRequest, 'sessionId'>): void;
  onRefreshRuntime(): void;
  onDraftConsumed(): void;
  onChooseWorkspaceFolder(): Promise<string | null>;
  onCreateWorkspace(root: string): Promise<DesktopWorkspace | undefined>;
  onSendPrompt(text: string, modelId: string): Promise<void>;
  onAbort(): void;
  onApprovalDecision(approvalId: string, decision: 'approved' | 'rejected', feedback?: string, selectedLabel?: string): Promise<boolean>;
  onAnswer(questionId: string, answers: Record<string, { kind: 'single'; optionId: string } | { kind: 'multi'; optionIds: string[] } | { kind: 'other'; text: string } | { kind: 'skipped' }>): void;
  onDismiss(questionId: string): void;
  onRenameTask?(sessionId: string, title: string): void;
  onArchiveTask?(sessionId: string): void;
  onLoadArchived(): void;
  onRestoreTask(sessionId: string): Promise<boolean>;
  onUndoTask(): Promise<boolean>;
  onCompactTask(instruction?: string): Promise<boolean>;
  onForkTask(title?: string): Promise<boolean>;
  onDismissError?(): void;
}

export function WorkbenchShell({
  status,
  workspaces,
  models,
  selectedModelId,
  selectedWorkspaceId,
  sessions,
  archivedSessions,
  archivedLoading,
  selectedSession,
  snapshot,
  runtime,
  runtimeLoading,
  runtimeUpdating,
  composerDraft,
  loading,
  error,
  pendingApprovalIds,
  newTaskRequest,
  sessionActionRequest,
  archivedRequest,
  onStart,
  onChooseCli = () => undefined,
  onStop,
  onSelectWorkspace,
  onSelectTask,
  onCreateTask,
  onSelectModel,
  onRuntimeChange,
  onRefreshRuntime,
  onDraftConsumed,
  onChooseWorkspaceFolder,
  onCreateWorkspace,
  onSendPrompt,
  onAbort,
  onApprovalDecision,
  onAnswer,
  onDismiss,
  onRenameTask = () => undefined,
  onArchiveTask = () => undefined,
  onLoadArchived,
  onRestoreTask,
  onUndoTask,
  onCompactTask,
  onForkTask,
  onDismissError = () => undefined,
}: WorkbenchShellProps) {
  const [contextOpen, setContextOpen] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<DesktopDiffTarget>();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [reviewError, setReviewError] = useState<string>();
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('kimi-desktop:sidebar') === 'collapsed');
  const [serviceDetailsOpen, setServiceDetailsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectingWorkspace, setSelectingWorkspace] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string>();
  const [renameValue, setRenameValue] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<DesktopSession>();
  const [sessionDialogAction, setSessionDialogAction] = useState<SessionDialogAction>();
  const [archivedOpen, setArchivedOpen] = useState(false);
  const lastNewTaskRequest = useRef(newTaskRequest);
  const lastSessionActionRequest = useRef(sessionActionRequest?.revision);
  const lastArchivedRequest = useRef(archivedRequest);

  const connected = status.server.kind === 'connected';
  const attentionCount = snapshot ? snapshot.approvals.length + snapshot.questions.length : 0;
  const selectedBackgroundTask = snapshot?.tasks.find((task) => task.id === selectedTaskId);
  const canShowContext = Boolean(selectedDiff || selectedBackgroundTask || (snapshot && (attentionCount > 0 || snapshot.todos.length > 0 || snapshot.tasks.length > 0 || runtime !== undefined || runtimeLoading)));
  const visibleError = reviewError ?? error;
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId);
  const statusSummary = presentWorkbenchStatus(status, selectedSession, snapshot);
  const filteredSessions = useMemo(() => filterSessions(sessions, query), [query, sessions]);

  useEffect(() => {
    if (newTaskRequest === undefined || newTaskRequest === lastNewTaskRequest.current) return;
    lastNewTaskRequest.current = newTaskRequest;
    setNewTaskOpen(true);
  }, [newTaskRequest]);

  useEffect(() => {
    if (!sessionActionRequest || sessionActionRequest.revision === lastSessionActionRequest.current) return;
    lastSessionActionRequest.current = sessionActionRequest.revision;
    window.setTimeout(() => setSessionDialogAction(sessionActionRequest.action), 0);
  }, [sessionActionRequest]);

  useEffect(() => {
    if (archivedRequest === undefined || archivedRequest === lastArchivedRequest.current) return;
    lastArchivedRequest.current = archivedRequest;
    setArchivedOpen(true);
  }, [archivedRequest]);

  useEffect(() => {
    localStorage.setItem('kimi-desktop:sidebar', sidebarCollapsed ? 'collapsed' : 'expanded');
  }, [sidebarCollapsed]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openNewTask();
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setSidebarCollapsed((value) => !value);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  });

  const openWorkspaceFolder = async () => {
    setSelectingWorkspace(true);
    try {
      const root = await onChooseWorkspaceFolder();
      if (!root) return;
      const workspace = await onCreateWorkspace(root);
      if (!workspace) return;
      onSelectWorkspace(workspace.id);
      setNewTaskOpen(true);
    } finally {
      setSelectingWorkspace(false);
    }
  };

  const openNewTask = () => {
    if (!connected) return;
    if (workspaces.length === 0) {
      void openWorkspaceFolder();
      return;
    }
    setNewTaskOpen(true);
  };

  const startRename = (session: DesktopSession) => {
    setRenamingSessionId(session.id);
    setRenameValue(session.title);
  };

  const commitRename = () => {
    const title = renameValue.trim();
    if (renamingSessionId && title) onRenameTask(renamingSessionId, title);
    setRenamingSessionId(undefined);
  };

  const requestSessionAction = (action: SessionDialogAction) => {
    window.setTimeout(() => setSessionDialogAction(action), 0);
  };

  const confirmArchive = () => {
    if (archiveTarget) onArchiveTask(archiveTarget.id);
    setArchiveTarget(undefined);
  };

  return (
    <main className={`workbench ${sidebarCollapsed ? 'workbench--sidebar-collapsed' : ''} ${contextOpen && canShowContext ? 'workbench--context-open' : ''}`}>
      <aside className="workbench-rail">
        <nav aria-label="工作台导航">
          <button type="button" className="rail-brand" aria-label="Kimi Code Desktop" onClick={() => setSidebarCollapsed(false)}><img src={kimiIcon} alt="" /></button>
          <button type="button" className="rail-action rail-action--primary" aria-label="新建任务" title="新建任务 Ctrl+N" disabled={!connected} onClick={openNewTask}><Plus size={18} /></button>
          <button type="button" className="rail-action rail-action--active" aria-label="任务工作台" aria-current="page"><Bot size={18} /></button>
        </nav>
        <div className="rail-bottom">
          <button type="button" className="rail-action" aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'} title="切换侧边栏 Ctrl+B" onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
          <button type="button" className="rail-action" aria-label="设置与关于" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
          <span className={`rail-status rail-status--${status.server.kind}`} title={statusSummary.service.label} />
        </div>
      </aside>

      <aside className="workbench-sidebar" aria-label="工作区与任务">
        <header className="sidebar-brand">
          <div><img src={kimiBanner} alt="Kimi Code" /><span>DESKTOP</span></div>
          <button type="button" className="icon-button" aria-label="收起侧边栏" onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={15} /></button>
        </header>

        <section className="workspace-switcher">
          <label htmlFor="workspace-select">当前工作区</label>
          <div className="workspace-select-wrap">
            <Folder size={15} />
            <select id="workspace-select" value={selectedWorkspaceId ?? ''} onChange={(event) => onSelectWorkspace(event.target.value)} disabled={!connected || workspaces.length === 0}>
              <option value="" disabled>{workspaces.length === 0 ? '尚未添加工作区' : '选择工作区'}</option>
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
            <ChevronDown size={14} />
          </div>
          <div className="workspace-path" title={selectedWorkspace?.root}>{selectedWorkspace?.root ?? '选择一个本机文件夹开始'}</div>
        </section>

        <div className="sidebar-toolbar">
          <label className="task-search">
            <Search size={14} />
            <input type="search" aria-label="搜索任务" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务" />
            {query ? <button type="button" aria-label="清除搜索" onClick={() => setQuery('')}><X size={13} /></button> : <kbd>⌘K</kbd>}
          </label>
          <button type="button" className="icon-button icon-button--strong" aria-label="新建任务" disabled={!connected} onClick={openNewTask}><Plus size={16} /></button>
        </div>

        <section className="session-section">
          <header><div><span>任务</span><small>{filteredSessions.length}</small></div><button type="button" className="session-section__archive" aria-label="查看已归档任务" title="查看已归档任务" onClick={() => setArchivedOpen(true)}><Archive size={13} /></button></header>
          <div className="session-list">
            {filteredSessions.map((session) => {
              const presentation = sessionPresentation(session);
              const active = session.id === selectedSession?.id;
              return (
                <article key={session.id} className={`session-row ${active ? 'session-row--active' : ''}`}>
                  {renamingSessionId === session.id ? (
                    <form className="session-rename" onSubmit={(event) => { event.preventDefault(); commitRename(); }}>
                      <input autoFocus aria-label="新的任务标题" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={commitRename} onKeyDown={(event) => { if (event.key === 'Escape') setRenamingSessionId(undefined); }} />
                    </form>
                  ) : (
                    <button type="button" className="session-row__main" onClick={() => onSelectTask(session.id)}>
                      <span className={`session-indicator session-indicator--${presentation.tone}`}>{session.busy ? <LoaderCircle size={12} /> : <CircleDot size={12} />}</span>
                      <span className="session-row__copy"><strong>{session.title || '未命名任务'}</strong><small>{session.lastPrompt || session.cwd || '等待第一条请求'}</small></span>
                      <span className="session-row__time">{formatSessionTime(session.updatedAt)}</span>
                    </button>
                  )}
                  <div className="session-row__actions">
                    <button type="button" aria-label="重命名任务" title="重命名任务" onClick={() => startRename(session)}><Pencil size={13} /></button>
                    <button type="button" aria-label="归档任务" title="归档任务" onClick={() => setArchiveTarget(session)}><Archive size={13} /></button>
                  </div>
                  <span className={`session-state session-state--${presentation.tone}`}>{presentation.label}</span>
                </article>
              );
            })}
            {filteredSessions.length === 0 ? <div className="session-list-empty"><Search size={18} /><span>{query ? '没有匹配的任务' : '这个工作区还没有任务'}</span><button type="button" onClick={openNewTask}>创建第一个任务</button></div> : null}
          </div>
        </section>

        <footer className={`runtime-card runtime-card--${status.server.kind}`}>
          <button type="button" className="runtime-card__summary" onClick={() => setServiceDetailsOpen((value) => !value)}>
            <span className="runtime-card__signal"><span /></span>
            <span><strong>{statusSummary.service.label}</strong><small>{statusSummary.cli.label}</small></span>
            <ChevronDown size={14} className={serviceDetailsOpen ? 'is-open' : ''} />
          </button>
          {serviceDetailsOpen ? (
            <div className="runtime-card__details">
              <div><span>CLI</span><strong>{status.cli.kind === 'ready' ? status.cli.version : '未就绪'}</strong></div>
              <div><span>服务</span><strong>{status.server.kind === 'connected' ? '已连接' : status.server.kind === 'starting' ? '启动中' : status.server.kind === 'failed' ? '异常' : '未启动'}</strong></div>
              {status.server.kind === 'idle' || status.server.kind === 'failed' ? <button type="button" onClick={status.cli.kind === 'ready' ? onStart : onChooseCli}>{status.cli.kind === 'ready' ? '启动本地服务' : '选择 CLI 文件'}</button> : null}
              {connected ? <button type="button" onClick={onStop}>关闭本地服务</button> : null}
            </div>
          ) : null}
        </footer>
      </aside>

      <section className="workbench-canvas">
        <header className="workbench-topbar">
          <div className="workbench-heading">
            <div className="breadcrumbs"><span>{selectedWorkspace?.name ?? '本地工作区'}</span><span>/</span><span title={selectedSession?.cwd}>{selectedSession ? leafPath(selectedSession.cwd) : '新任务'}</span></div>
            <div className="workbench-heading__line">
              <h1>{selectedSession?.title || '开始一个本地任务'}</h1>
              <span className={`task-phase task-phase--${statusSummary.task.tone}`}><span />{statusSummary.task.label}</span>
            </div>
            {selectedSession ? (
              <div className="workbench-heading__meta">
                {runtimeLoading ? <span><LoaderCircle size={12} className="spin" />正在读取运行策略</span> : null}
                {runtime?.available && runtime.model ? <span><Bot size={12} />{runtime.model}</span> : null}
                {runtime?.available ? <span><BrainCircuit size={12} />思考 {thinkingLabel(runtime.thinkingLevel)}</span> : null}
                {runtime?.available ? <span><Gauge size={12} />{permissionLabel(runtime.permission)}</span> : null}
                {runtime?.available && runtime.planMode ? <span className="runtime-badge--plan"><Route size={12} />计划模式</span> : null}
                {runtime?.available ? <span>上下文 {Math.round(runtime.contextUsage * 100)}%</span> : null}
                {runtime?.available === false ? <span>当前 CLI 不支持运行策略控制</span> : null}
              </div>
            ) : null}
          </div>
          <div className="workbench-actions">
            {selectedSession?.busy ? <button type="button" className="toolbar-button toolbar-button--danger" onClick={onAbort}><Square size={13} />停止</button> : null}
            {canShowContext ? <button type="button" className={`toolbar-button ${attentionCount > 0 ? 'toolbar-button--attention' : ''}`} onClick={() => setContextOpen((value) => !value)}><PanelRight size={15} />{attentionCount > 0 ? `待处理 ${attentionCount}` : '详情'}</button> : null}
            {selectedSession ? <SessionActionsMenu busy={selectedSession.busy} onUndoRequest={() => requestSessionAction('undo')} onCompactRequest={() => requestSessionAction('compact')} onForkRequest={() => requestSessionAction('fork')} onRenameRequest={() => startRename(selectedSession)} onArchiveRequest={() => setArchiveTarget(selectedSession)} /> : null}
          </div>
        </header>

        {visibleError ? <div className="workbench-error" role="alert"><span>{visibleError}</span><button type="button" aria-label="关闭错误提示" onClick={() => { if (reviewError) setReviewError(undefined); else onDismissError(); }}><X size={14} /></button></div> : null}

        {selectedSession ? (
          <div className="task-canvas">
            <TaskTimeline snapshot={snapshot} loading={loading} pendingApprovalIds={pendingApprovalIds} onApprovalDecision={onApprovalDecision} onOpenDiff={(target) => { setSelectedDiff(target); setSelectedTaskId(undefined); setContextOpen(true); }} onOpenTask={(taskId) => { setSelectedTaskId(taskId); setSelectedDiff(undefined); setContextOpen(true); }} />
            <TaskComposer disabled={!connected} busy={selectedSession.busy} models={models} selectedModelId={selectedModelId} runtime={runtime} runtimeUpdating={runtimeUpdating} draft={composerDraft} onDraftConsumed={onDraftConsumed} onModelChange={onSelectModel} onRuntimeChange={onRuntimeChange} onSubmit={onSendPrompt} />
          </div>
        ) : (
          <section className="workbench-empty">
            <div className="empty-mark"><img src={kimiIcon} alt="" /><span /></div>
            <p className="eyebrow">KIMI CODE · LOCAL AGENT</p>
            <h2>{!connected ? '启动本地服务' : selectedWorkspace ? '把一个目标交给 Kimi Code' : '选择一个工作区开始'}</h2>
            <p>{!connected ? '桌面端将使用系统中已登录的 Kimi Code CLI 启动本机服务，应用退出时会自动关闭由桌面端启动的服务。' : selectedWorkspace ? '任务会在本机工作区中运行，过程、工具调用和待确认操作都会集中显示在这里。' : '桌面端直接连接你系统中的 Kimi Code CLI，不接管登录信息，也不会修改上游安装。'}</p>
            <div className="workbench-empty__actions">
              {!connected ? (
                <button type="button" className="button" onClick={onStart}><Gauge size={15} />启动本地服务</button>
              ) : (
                <>
                  <button type="button" className="button" onClick={selectedWorkspace ? openNewTask : () => void openWorkspaceFolder()}>{selectedWorkspace ? <Plus size={15} /> : <FolderPlus size={15} />}{selectedWorkspace ? '新建任务' : selectingWorkspace ? '正在选择…' : '打开本机文件夹'}</button>
                  {selectedWorkspace ? <button type="button" className="button button--secondary" onClick={() => void openWorkspaceFolder()}><FolderPlus size={15} />添加工作区</button> : null}
                </>
              )}
            </div>
            <div className="empty-shortcuts"><span><kbd>Ctrl</kbd><kbd>N</kbd>新建任务</span><span><kbd>Ctrl</kbd><kbd>K</kbd>命令面板</span></div>
          </section>
        )}
      </section>

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} workspaces={workspaces} selectedWorkspaceId={selectedWorkspaceId} onCreateTask={onCreateTask} onChooseFolder={onChooseWorkspaceFolder} onCreateWorkspace={onCreateWorkspace} />
      <SettingsDialog open={settingsOpen} status={status} onOpenChange={setSettingsOpen} />


      <SessionActionDialogs action={sessionDialogAction} sessionTitle={selectedSession?.title ?? ''} onClose={() => setSessionDialogAction(undefined)} onUndo={onUndoTask} onCompact={onCompactTask} onFork={onForkTask} />
      <ArchivedSessionsDialog open={archivedOpen} sessions={archivedSessions} loading={archivedLoading} onOpenChange={setArchivedOpen} onLoad={onLoadArchived} onRestore={onRestoreTask} />

      <Dialog.Root open={archiveTarget !== undefined} onOpenChange={(open) => { if (!open) setArchiveTarget(undefined); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="confirm-dialog" aria-label="归档任务">
            <div className="confirm-dialog__icon"><Archive size={18} /></div>
            <Dialog.Title>归档这个任务？</Dialog.Title>
            <Dialog.Description>“{archiveTarget?.title}”将从当前任务列表中移除，但仍保留在 Kimi Code 的本地记录中。</Dialog.Description>
            <footer><Dialog.Close asChild><button type="button" className="button button--secondary">取消</button></Dialog.Close><button type="button" className="button button--danger" onClick={confirmArchive}>归档任务</button></footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {contextOpen && selectedDiff ? (
        <DiffReviewPanel
          target={selectedDiff}
          onClose={() => { setSelectedDiff(undefined); setContextOpen(false); }}
          onCopyPath={(path) => { void window.desktop.copyText({ text: path }).catch(() => setReviewError('无法复制文件路径。')); }}
          onCopyDiff={(text) => { void window.desktop.copyText({ text }).catch(() => setReviewError('无法复制差异内容。')); }}
          onRevealPath={(path) => { void window.desktop.revealPath({ path }).catch(() => setReviewError('无法在资源管理器中显示该文件。')); }}
        />
      ) : contextOpen && selectedBackgroundTask ? (
        <BackgroundTaskPanel task={selectedBackgroundTask} onClose={() => { setSelectedTaskId(undefined); setContextOpen(false); }} />
      ) : contextOpen && snapshot && canShowContext ? <ContextDock snapshot={snapshot} runtime={runtime} runtimeLoading={runtimeLoading} onRefreshRuntime={onRefreshRuntime} onSelectTask={(taskId) => { setSelectedTaskId(taskId); setSelectedDiff(undefined); setContextOpen(true); }} onAnswer={onAnswer} onDismiss={onDismiss} onClose={() => setContextOpen(false)} /> : null}
    </main>
  );
}

function thinkingLabel(value: string): string {
  const labels: Record<string, string> = { off: '关闭', on: '开启', minimal: '极简', low: '低', medium: '中', high: '高', max: '最高' };
  return labels[value] ?? value;
}

function permissionLabel(permission: 'manual' | 'yolo' | 'auto' | undefined): string {
  if (permission === 'manual') return '手动确认';
  if (permission === 'auto') return '自动执行';
  if (permission === 'yolo') return '完全自动';
  return '默认权限';
}

function leafPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
