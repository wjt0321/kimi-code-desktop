import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Archive, ChevronRight, CopyPlus, FilePenLine, MoreHorizontal, RotateCcw, Sparkles } from 'lucide-react';

interface SessionActionsMenuProps {
  busy: boolean;
  onUndoRequest(): void;
  onCompactRequest(): void;
  onForkRequest(): void;
  onRenameRequest(): void;
  onArchiveRequest(): void;
}

export function SessionActionsMenu({ busy, onUndoRequest, onCompactRequest, onForkRequest, onRenameRequest, onArchiveRequest }: SessionActionsMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="icon-button" aria-label="更多任务操作" title="更多任务操作"><MoreHorizontal size={17} /></button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="session-actions-menu" side="bottom" align="end" sideOffset={8} collisionPadding={12}>
          <div className="session-actions-menu__heading"><span>任务操作</span><small>{busy ? '正在运行' : '当前任务'}</small></div>
          <MenuItem icon={<RotateCcw size={14} />} label="撤回上一轮" hint="恢复请求到输入框" disabled={busy} onSelect={onUndoRequest} />
          <MenuItem icon={<Sparkles size={14} />} label="压缩上下文" hint="释放上下文空间" disabled={busy} onSelect={onCompactRequest} />
          <MenuItem icon={<CopyPlus size={14} />} label="派生新任务" hint="从当前上下文创建副本" disabled={busy} onSelect={onForkRequest} />
          {busy ? <div className="session-actions-menu__notice">任务运行时不可用</div> : null}
          <DropdownMenu.Separator className="session-actions-menu__separator" />
          <MenuItem icon={<FilePenLine size={14} />} label="重命名任务" onSelect={onRenameRequest} />
          <MenuItem icon={<Archive size={14} />} label="归档任务" danger onSelect={onArchiveRequest} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({ icon, label, hint, disabled = false, danger = false, onSelect }: { icon: React.ReactNode; label: string; hint?: string; disabled?: boolean; danger?: boolean; onSelect(): void }) {
  return (
    <DropdownMenu.Item className={`session-actions-menu__item ${danger ? 'is-danger' : ''}`} aria-label={label} disabled={disabled} onSelect={onSelect}>
      <span className="session-actions-menu__icon">{icon}</span>
      <span className="session-actions-menu__copy"><strong>{label}</strong>{hint ? <small>{hint}</small> : null}</span>
      <ChevronRight size={12} />
    </DropdownMenu.Item>
  );
}
