import * as Dialog from '@radix-ui/react-dialog';
import { FolderPlus, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DesktopWorkspace } from '../../../shared/contracts';

interface WorkspaceDialogsProps {
  createOpen: boolean;
  renameTarget?: DesktopWorkspace;
  removeTarget?: DesktopWorkspace;
  onCreateOpenChange(open: boolean): void;
  onRenameClose(): void;
  onRemoveClose(): void;
  onCreate(name: string): Promise<boolean>;
  onRename(workspaceId: string, name: string): Promise<boolean>;
  onRemove(workspaceId: string): Promise<boolean>;
}

export function WorkspaceDialogs({ createOpen, renameTarget, removeTarget, onCreateOpenChange, onRenameClose, onRemoveClose, onCreate, onRename, onRemove }: WorkspaceDialogsProps) {
  const [name, setName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => { if (createOpen) setName(''); }, [createOpen]);
  useEffect(() => { setRenameName(renameTarget?.name ?? ''); }, [renameTarget]);

  return (
    <>
      <Dialog.Root open={createOpen} onOpenChange={pending ? undefined : onCreateOpenChange}>
        <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="workspace-dialog" aria-label="创建新工作区">
          <header><div><Dialog.Title>创建新工作区</Dialog.Title><Dialog.Description>输入文件夹名称，然后选择父目录。桌面端只会新建这个子文件夹。</Dialog.Description></div><Dialog.Close asChild><button type="button" className="icon-button" aria-label="关闭"><X size={16} /></button></Dialog.Close></header>
          <label><span>工作区名称</span><div className="workspace-dialog__input"><FolderPlus size={15} /><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：kimi-desktop" /></div></label>
          <footer><Dialog.Close asChild><button type="button" className="button button--secondary">取消</button></Dialog.Close><button type="button" className="button" disabled={!name.trim() || pending} onClick={() => void (async () => { setPending(true); try { if (await onCreate(name.trim())) onCreateOpenChange(false); } finally { setPending(false); } })()}>{pending ? <LoaderCircle size={14} className="spin" /> : null}{pending ? '正在创建…' : '选择位置并创建'}</button></footer>
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={renameTarget !== undefined} onOpenChange={(open) => { if (!open && !pending) onRenameClose(); }}>
        <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="workspace-dialog" aria-label="重命名工作区">
          <header><div><Dialog.Title>重命名工作区</Dialog.Title><Dialog.Description>只修改桌面端显示名称，不会重命名本地文件夹。</Dialog.Description></div><button type="button" className="icon-button" aria-label="关闭" onClick={onRenameClose}><X size={16} /></button></header>
          <label><span>显示名称</span><div className="workspace-dialog__input"><input autoFocus value={renameName} onChange={(event) => setRenameName(event.target.value)} /></div></label>
          <footer><button type="button" className="button button--secondary" onClick={onRenameClose}>取消</button><button type="button" className="button" disabled={!renameName.trim() || pending} onClick={() => void (async () => { if (!renameTarget) return; setPending(true); try { if (await onRename(renameTarget.id, renameName.trim())) onRenameClose(); } finally { setPending(false); } })()}>保存</button></footer>
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={removeTarget !== undefined} onOpenChange={(open) => { if (!open && !pending) onRemoveClose(); }}>
        <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="workspace-dialog workspace-dialog--danger" aria-label="清除工作区">
          <header><div><Dialog.Title>从列表清除工作区？</Dialog.Title><Dialog.Description>“{removeTarget?.name}”只会从桌面端和本地服务的工作区列表中清除，本地文件不会被删除。</Dialog.Description></div><button type="button" className="icon-button" aria-label="关闭" onClick={onRemoveClose}><X size={16} /></button></header>
          <footer><button type="button" className="button button--secondary" onClick={onRemoveClose}>取消</button><button type="button" className="button button--danger" disabled={pending} onClick={() => void (async () => { if (!removeTarget) return; setPending(true); try { if (await onRemove(removeTarget.id)) onRemoveClose(); } finally { setPending(false); } })()}>从列表清除</button></footer>
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
