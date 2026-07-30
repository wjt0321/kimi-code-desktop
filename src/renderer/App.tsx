import { useEffect, useState } from 'react';

import { WorkbenchShell } from './components/workbench/WorkbenchShell';
import { CliSetupView } from './components/CliSetupView';
import { CommandPalette } from './components/CommandPalette';
import { ExitDialog } from './components/ExitDialog';
import { useDesktopStatus } from './hooks/useDesktopStatus';
import { useWorkbench } from './hooks/useWorkbench';

export function App() {
  const [newTaskRequest, setNewTaskRequest] = useState(0);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [sessionActionRequest, setSessionActionRequest] = useState<{ revision: number; action: 'compact' | 'fork' | 'undo' }>();
  const [archivedRequest, setArchivedRequest] = useState(0);
  const desktop = useDesktopStatus();
  const { status } = desktop;
  const workbench = useWorkbench(status.server.kind === 'connected');

  useEffect(() => window.desktop.onCloseRequested(() => setExitDialogOpen(true)), []);

  const exitDialog = (
    <ExitDialog
      open={exitDialogOpen}
      onCancel={() => setExitDialogOpen(false)}
      onConfirm={() => {
        setExitDialogOpen(false);
        window.desktop.confirmClose();
      }}
    />
  );

  if (status.cli.kind !== 'ready') {
    return (
      <>
        <CliSetupView
          cli={status.cli}
          onRefresh={() => void desktop.refreshCli()}
          onChoose={() => void desktop.chooseCliExecutable()}
        />
        {exitDialog}
      </>
    );
  }

  const selectedSessionId = workbench.selectedSessionId;

  return (
    <>
      <WorkbenchShell
        status={status}
        workspaces={workbench.workspaces}
        models={workbench.models}
        selectedModelId={workbench.activeModelId}
        selectedWorkspaceId={workbench.selectedWorkspaceId}
        sessions={workbench.sessions}
        archivedSessions={workbench.archivedSessions}
        archivedLoading={workbench.archivedLoading}
        selectedSession={workbench.selectedSession}
        snapshot={workbench.snapshot}
        runtime={workbench.runtime}
        runtimeLoading={workbench.runtimeLoading}
        runtimeUpdating={workbench.runtimeUpdating}
        composerDraft={workbench.composerDraft}
        loading={workbench.loading}
        error={workbench.error}
        newTaskRequest={newTaskRequest}
        sessionActionRequest={sessionActionRequest}
        archivedRequest={archivedRequest}
        onStart={() => void desktop.startServer()}
        onChooseCli={() => void desktop.chooseCliExecutable()}
        onStop={() => void desktop.stopServer()}
        onSelectWorkspace={workbench.actions.selectWorkspace}
        onSelectTask={workbench.actions.selectTask}
        onCreateTask={(input) => void workbench.actions.createTask(input)}
        onSelectModel={workbench.actions.selectModel}
        onRuntimeChange={(patch) => void workbench.actions.updateRuntime(patch)}
        onRefreshRuntime={() => void workbench.actions.refreshRuntime()}
        onDraftConsumed={workbench.actions.clearComposerDraft}
        onChooseWorkspaceFolder={workbench.actions.chooseWorkspaceFolder}
        onCreateWorkspace={workbench.actions.createWorkspace}
        onSendPrompt={workbench.actions.sendPrompt}
        onAbort={() => void workbench.actions.abort()}
        onApprove={(approvalId) => selectedSessionId && void workbench.actions.respondApproval({ sessionId: selectedSessionId, approvalId, decision: 'approved' })}
        onReject={(approvalId) => selectedSessionId && void workbench.actions.respondApproval({ sessionId: selectedSessionId, approvalId, decision: 'rejected' })}
        onAnswer={(questionId, answers) => selectedSessionId && void workbench.actions.respondQuestion({ sessionId: selectedSessionId, questionId, answers })}
        onDismiss={(questionId) => selectedSessionId && void workbench.actions.dismissQuestion({ sessionId: selectedSessionId, questionId })}
        onRenameTask={(sessionId, title) => void workbench.actions.renameTask(sessionId, title)}
        onArchiveTask={(sessionId) => void workbench.actions.archiveTask(sessionId)}
        onLoadArchived={() => void workbench.actions.loadArchivedSessions()}
        onRestoreTask={workbench.actions.restoreTask}
        onUndoTask={workbench.actions.undoTask}
        onCompactTask={workbench.actions.compactTask}
        onForkTask={workbench.actions.forkTask}
        onDismissError={workbench.actions.clearError}
      />
      <CommandPalette
        status={status}
        onStart={() => void desktop.startServer()}
        onStop={() => void desktop.stopServer()}
        onRefresh={() => void desktop.refreshCli()}
        onChoose={() => void desktop.chooseCliExecutable()}
        onCreateTask={() => setNewTaskRequest((value) => value + 1)}
        hasSession={workbench.selectedSession !== undefined}
        sessionBusy={workbench.selectedSession?.busy ?? false}
        runtimeAvailable={workbench.runtime?.available ?? false}
        planMode={workbench.runtime?.planMode ?? false}
        onRefreshRuntime={() => void workbench.actions.refreshRuntime()}
        onTogglePlan={() => { if (workbench.runtime?.available) void workbench.actions.updateRuntime({ planMode: !workbench.runtime.planMode }); }}
        onUndo={() => void workbench.actions.undoTask()}
        onOpenCompact={() => setSessionActionRequest((current) => ({ revision: (current?.revision ?? 0) + 1, action: 'compact' }))}
        onOpenFork={() => setSessionActionRequest((current) => ({ revision: (current?.revision ?? 0) + 1, action: 'fork' }))}
        onOpenArchived={() => setArchivedRequest((value) => value + 1)}
      />
      {exitDialog}
    </>
  );
}
