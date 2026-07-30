import * as Dialog from '@radix-ui/react-dialog';
import { CopyPlus, LoaderCircle, RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type SessionDialogAction = 'undo' | 'compact' | 'fork';

interface SessionActionDialogsProps {
  action: SessionDialogAction | undefined;
  sessionTitle: string;
  onClose(): void;
  onUndo(): Promise<boolean>;
  onCompact(instruction?: string): Promise<boolean>;
  onFork(title?: string): Promise<boolean>;
}

const content = {
  undo: {
    eyebrow: '回退任务',
    title: '撤回上一轮请求？',
    description: 'Kimi Code 会移除最近一轮交互，并把你的上一条请求恢复到输入框中供你修改。',
    confirm: '确认撤回',
    icon: RotateCcw,
  },
  compact: {
    eyebrow: '上下文管理',
    title: '压缩当前上下文',
    description: '将较早的对话整理为摘要，保留关键结论和工作状态，为后续任务释放空间。',
    confirm: '开始压缩',
    icon: Sparkles,
  },
  fork: {
    eyebrow: '任务分支',
    title: '派生一个新任务',
    description: '复制当前任务的上下文与运行策略，新任务和原任务之后可以独立继续。',
    confirm: '创建新任务',
    icon: CopyPlus,
  },
} as const;

export function SessionActionDialogs({ action, sessionTitle, onClose, onUndo, onCompact, onFork }: SessionActionDialogsProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValue('');
    setSubmitting(false);
  }, [action]);

  if (!action) return null;
  const presentation = content[action];
  const Icon = presentation.icon;

  const confirm = async () => {
    setSubmitting(true);
    const trimmed = value.trim();
    try {
      const success = action === 'undo'
        ? await onUndo()
        : action === 'compact'
          ? await onCompact(trimmed || undefined)
          : await onFork(trimmed || undefined);
      if (success) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="session-action-dialog" aria-label={presentation.title}>
          <header>
            <span className="session-action-dialog__icon"><Icon size={18} /></span>
            <Dialog.Close asChild><button type="button" className="icon-button" aria-label="关闭" disabled={submitting}><X size={15} /></button></Dialog.Close>
          </header>
          <p className="eyebrow">{presentation.eyebrow}</p>
          <Dialog.Title>{presentation.title}</Dialog.Title>
          <Dialog.Description>{presentation.description}</Dialog.Description>
          <div className="session-action-dialog__session"><span>当前任务</span><strong>{sessionTitle || '未命名任务'}</strong></div>
          {action === 'compact' ? (
            <label className="dialog-field"><span>压缩要求 <small>可选</small></span><textarea aria-label="压缩要求（可选）" rows={3} value={value} onChange={(event) => setValue(event.target.value)} placeholder="例如：保留测试结论、错误堆栈和后续步骤" /></label>
          ) : null}
          {action === 'fork' ? (
            <label className="dialog-field"><span>新任务标题 <small>可选</small></span><input aria-label="新任务标题（可选）" value={value} onChange={(event) => setValue(event.target.value)} placeholder="未填写时由 Kimi Code 生成" /></label>
          ) : null}
          <footer>
            <button type="button" className="button button--secondary" disabled={submitting} onClick={onClose}>取消</button>
            <button type="button" className="button" disabled={submitting} onClick={() => void confirm()}>{submitting ? <LoaderCircle size={14} className="spin" /> : <Icon size={14} />}{submitting ? '正在处理…' : presentation.confirm}</button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
