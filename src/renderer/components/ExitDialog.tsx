import * as Dialog from '@radix-ui/react-dialog';
import { LogOut, Server, X } from 'lucide-react';

interface ExitDialogProps {
  open: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export function ExitDialog({ open, onCancel, onConfirm }: ExitDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay exit-dialog-overlay" />
        <Dialog.Content className="confirm-dialog exit-dialog" aria-describedby="exit-dialog-description">
          <header className="exit-dialog__header">
            <div className="exit-dialog__icon"><LogOut size={20} /></div>
            <Dialog.Close asChild><button type="button" className="icon-button" aria-label="关闭退出确认"><X size={15} /></button></Dialog.Close>
          </header>
          <div className="exit-dialog__eyebrow">KIMI CODE DESKTOP</div>
          <Dialog.Title>退出 Kimi Code Desktop</Dialog.Title>
          <Dialog.Description id="exit-dialog-description">确定要结束本次桌面工作吗？</Dialog.Description>
          <div className="exit-dialog__notice"><Server size={15} /><span>由桌面端启动的本地 CLI 服务也会一并关闭，正在运行的任务将停止。</span></div>
          <footer>
            <Dialog.Close asChild><button type="button" className="button button--secondary">取消</button></Dialog.Close>
            <button type="button" className="button button--danger" onClick={onConfirm}><LogOut size={14} />退出应用</button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
