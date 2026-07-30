import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { useEffect, useState } from 'react';

import type { DesktopStatus } from '../../shared/contracts';

interface CommandPaletteProps {
  status: DesktopStatus;
  onStart(): void;
  onStop(): void;
  onRefresh(): void;
  onChoose(): void;
  onCreateTask(): void;
}

export function CommandPalette({
  status,
  onStart,
  onStop,
  onRefresh,
  onChoose,
  onCreateTask,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const ready = status.cli.kind === 'ready';
  const connected = status.server.kind === 'connected';
  const active = status.server.kind === 'starting' || connected;
  const select = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="command-overlay" />
        <Dialog.Content className="command-dialog" aria-label="命令面板">
          <Command label="命令面板">
            <Command.Input autoFocus placeholder="搜索命令" />
            <Command.List>
              <Command.Empty>没有匹配的命令。</Command.Empty>
              <Command.Group heading="工作台">
                <Command.Item disabled={!connected} onSelect={() => select(onCreateTask)}>新建任务</Command.Item>
                <Command.Item disabled={!ready || active} onSelect={() => select(onStart)}>启动本地服务</Command.Item>
                <Command.Item disabled={!active} onSelect={() => select(onStop)}>关闭本地服务</Command.Item>
                <Command.Item onSelect={() => select(onRefresh)}>刷新 CLI 检测</Command.Item>
                <Command.Item onSelect={() => select(onChoose)}>选择 CLI 可执行文件</Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
