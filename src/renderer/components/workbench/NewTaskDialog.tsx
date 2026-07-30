import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, Folder, FolderPlus, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { CreateTaskRequest, DesktopWorkspace } from '../../../shared/contracts';

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  workspaces: DesktopWorkspace[];
  selectedWorkspaceId: string | undefined;
  onCreateTask(input: CreateTaskRequest): void | Promise<unknown>;
  onChooseFolder(): Promise<string | null>;
  onCreateWorkspace(root: string): Promise<DesktopWorkspace | undefined>;
}

export function NewTaskDialog({ open, onOpenChange, workspaces, selectedWorkspaceId, onCreateTask, onChooseFolder, onCreateWorkspace }: NewTaskDialogProps) {
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId ?? '');
  const [title, setTitle] = useState('');
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setWorkspaceId(selectedWorkspaceId ?? workspaces[0]?.id ?? '');
      setTitle('');
    }
    wasOpen.current = open;
  }, [open, selectedWorkspaceId, workspaces]);

  const create = async () => {
    if (!workspaceId || submitting) return;
    setSubmitting(true);
    try {
      await onCreateTask({ target: 'workspace', workspaceId, title: title.trim() || undefined });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const chooseFolder = async () => {
    if (selectingFolder || submitting) return;
    setSelectingFolder(true);
    try {
      const root = await onChooseFolder();
      if (!root) return;
      const workspace = await onCreateWorkspace(root);
      if (!workspace) return;
      await onCreateTask({ target: 'workspace', workspaceId: workspace.id, title: title.trim() || undefined });
      onOpenChange(false);
    } finally {
      setSelectingFolder(false);
    }
  };

  const selected = workspaces.find((workspace) => workspace.id === workspaceId);
  return (
    <Dialog.Root open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="new-task-dialog" aria-label="新建任务">
          <Dialog.Title>新建任务</Dialog.Title>
          <Dialog.Description>选择项目并创建一个独立任务，创建后会自动切换到对应工作区。</Dialog.Description>
          <label className="new-task-dialog__field">
            <span>工作区</span>
            <Select.Root value={workspaceId} onValueChange={setWorkspaceId} disabled={submitting}>
              <Select.Trigger className="workspace-picker-trigger" aria-label="工作区">
                <Folder size={15} />
                <Select.Value placeholder="选择工作区">{selected ? <span><strong>{selected.name}</strong><small>{selected.root}</small></span> : undefined}</Select.Value>
                <Select.Icon><ChevronDown size={14} /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="workspace-picker-content" position="popper" sideOffset={6} collisionPadding={12}>
                  <Select.Viewport>
                    {workspaces.map((workspace) => (
                      <Select.Item key={workspace.id} value={workspace.id} className="workspace-picker-item" textValue={`${workspace.name} ${workspace.root}`}>
                        <Select.ItemText><span><strong>{workspace.name}</strong><small>{workspace.root}</small></span></Select.ItemText>
                        <Select.ItemIndicator><Check size={14} /></Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </label>
          <label className="new-task-dialog__field"><span>任务标题</span><input aria-label="任务标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：修复登录超时" /></label>
          <div className="new-task-dialog__folder"><span>没有合适的工作区？</span><button type="button" onClick={() => void chooseFolder()} disabled={selectingFolder || submitting}><FolderPlus size={14} />{selectingFolder ? '正在选择…' : '添加本机文件夹'}</button></div>
          <footer><Dialog.Close asChild><button type="button" className="button button--secondary" disabled={submitting}>取消</button></Dialog.Close><button type="button" className="button" disabled={!workspaceId || submitting} onClick={() => void create()}>{submitting ? <LoaderCircle size={14} className="spin" /> : null}{submitting ? '正在创建…' : '创建任务'}</button></footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
