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
  hasSession: boolean;
  sessionBusy: boolean;
  runtimeAvailable: boolean;
  planMode: boolean;
  onRefreshRuntime(): void;
  onTogglePlan(): void;
  onUndo(): void;
  onOpenCompact(): void;
  onOpenFork(): void;
  onOpenArchived(): void;
}

export function CommandPalette({
  status,
  onStart,
  onStop,
  onRefresh,
  onChoose,
  onCreateTask,
  hasSession,
  sessionBusy,
  runtimeAvailable,
  planMode,
  onRefreshRuntime,
  onTogglePlan,
  onUndo,
  onOpenCompact,
  onOpenFork,
  onOpenArchived,
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
              <Command.Group heading="当前任务">
                <Command.Item disabled={!hasSession || !runtimeAvailable} onSelect={() => select(onRefreshRuntime)}>刷新任务运行状态</Command.Item>
                <Command.Item disabled={!hasSession || !runtimeAvailable} onSelect={() => select(onTogglePlan)}>{planMode ? '关闭计划模式' : '开启计划模式'}</Command.Item>
                <Command.Item disabled={!hasSession || sessionBusy} onSelect={() => select(onUndo)}>撤回上一轮</Command.Item>
                <Command.Item disabled={!hasSession || sessionBusy} onSelect={() => select(onOpenCompact)}>压缩上下文…</Command.Item>
                <Command.Item disabled={!hasSession || sessionBusy} onSelect={() => select(onOpenFork)}>派生新任务…</Command.Item>
                <Command.Item disabled={!connected} onSelect={() => select(onOpenArchived)}>查看已归档任务</Command.Item>
              </Command.Group>
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
