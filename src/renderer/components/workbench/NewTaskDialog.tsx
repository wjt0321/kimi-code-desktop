import * as Dialog from '@radix-ui/react-dialog';
import { FolderPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { CreateTaskRequest, DesktopWorkspace } from '../../../shared/contracts';

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  workspaces: DesktopWorkspace[];
  selectedWorkspaceId: string | undefined;
  onCreateTask(input: CreateTaskRequest): void;
  onChooseFolder(): Promise<string | null>;
  onCreateWorkspace(root: string): Promise<DesktopWorkspace | undefined>;
}

export function NewTaskDialog({
  open,
  onOpenChange,
  workspaces,
  selectedWorkspaceId,
  onCreateTask,
  onChooseFolder,
  onCreateWorkspace,
}: NewTaskDialogProps) {
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId ?? '');
  const [title, setTitle] = useState('');
  const [selectingFolder, setSelectingFolder] = useState(false);

  useEffect(() => {
    if (open) setWorkspaceId(selectedWorkspaceId ?? workspaces[0]?.id ?? '');
  }, [open, selectedWorkspaceId, workspaces]);

  const create = () => {
    if (!workspaceId) return;
    onCreateTask({ target: 'workspace', workspaceId, title: title.trim() || undefined });
    setTitle('');
    onOpenChange(false);
  };

  const chooseFolder = async () => {
    setSelectingFolder(true);
    try {
      const root = await onChooseFolder();
      if (!root) return;
      const workspace = await onCreateWorkspace(root);
      if (!workspace) return;
      onCreateTask({ target: 'workspace', workspaceId: workspace.id, title: title.trim() || undefined });
      setTitle('');
      onOpenChange(false);
    } finally {
      setSelectingFolder(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="new-task-dialog" aria-label="新建任务">
          <Dialog.Title>新建任务</Dialog.Title>
          <Dialog.Description>任务将绑定到一个真实的本机工作区。</Dialog.Description>
          <label>
            <span>工作区</span>
            <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
              <option value="" disabled>选择工作区</option>
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.root}</option>)}
            </select>
          </label>
          <label>
            <span>任务标题</span>
            <input aria-label="任务标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：修复登录超时" />
          </label>
          <div className="new-task-dialog__folder"><span>没有合适的工作区？</span><button type="button" onClick={() => void chooseFolder()} disabled={selectingFolder}><FolderPlus size={14} />选择本机文件夹</button></div>
          <footer><Dialog.Close asChild><button type="button" className="button button--secondary">取消</button></Dialog.Close><button type="button" className="button" disabled={!workspaceId} onClick={create}>创建任务</button></footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
