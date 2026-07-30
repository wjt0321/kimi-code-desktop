import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, LoaderCircle, PackageCheck, Server, TerminalSquare, X } from 'lucide-react';
import { useRef } from 'react';

import type { DesktopCliUpdateSnapshot } from '../../../shared/contracts';
import { installSourceLabel } from './CliUpdateSection';

interface CliUpdateDialogProps {
  open: boolean;
  snapshot: DesktopCliUpdateSnapshot;
  serviceActive: boolean;
  onConfirm(): void;
  onOpenChange(open: boolean): void;
}

const lockedPhases = new Set<DesktopCliUpdateSnapshot['phase']>([
  'stopping-service',
  'installing',
  'verifying',
  'restarting-service',
]);

export function CliUpdateDialog({ open, snapshot, serviceActive, onConfirm, onOpenChange }: CliUpdateDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const locked = lockedPhases.has(snapshot.phase);
  const succeeded = snapshot.phase === 'succeeded';

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!locked) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay cli-update-dialog-overlay" />
        <Dialog.Content
          className="cli-update-dialog"
          aria-label="确认 CLI 升级"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
        >
          <header>
            <span className="cli-update-dialog__mark"><PackageCheck size={20} /></span>
            <div>
              <span className="cli-update-dialog__eyebrow">KIMI CODE CLI</span>
              <Dialog.Title>{locked ? '正在升级 CLI' : succeeded ? 'CLI 升级完成' : '确认升级 CLI'}</Dialog.Title>
              <Dialog.Description>{locked ? dialogPhaseLabel(snapshot.phase) : '桌面端只会执行下面这条固定升级命令。'}</Dialog.Description>
            </div>
            {!locked ? <Dialog.Close asChild><button type="button" className="icon-button" aria-label="关闭升级确认"><X size={16} /></button></Dialog.Close> : null}
          </header>

          <div className="cli-update-dialog__version">
            <strong>{snapshot.currentVersion ?? '—'}</strong><ArrowRight size={16} /><strong>{snapshot.latestVersion ?? '—'}</strong>
          </div>

          <dl className="cli-update-dialog__facts">
            <div><dt><TerminalSquare size={14} />安装来源</dt><dd>{installSourceLabel(snapshot.installSource)}</dd></div>
            <div><dt><Server size={14} />本地服务</dt><dd>{serviceActive ? '升级前关闭，完成后自动恢复' : '当前未运行，不会自动启动'}</dd></div>
          </dl>

          <div className="cli-update-dialog__command">
            <span>将执行</span>
            <code>{snapshot.installCommand ?? 'kimi upgrade'}</code>
          </div>

          <p className="cli-update-dialog__notice">
            {serviceActive ? '本地服务会先安全关闭；升级和版本校验完成后，桌面端会自动重新启动服务。' : '升级完成后会重新检测 CLI 版本和可用能力。'}
          </p>
          {snapshot.detail ? <pre className="cli-update-detail">{snapshot.detail}</pre> : null}

          <footer>
            {locked ? (
              <button type="button" className="button" disabled><LoaderCircle size={14} className="spin" />正在升级</button>
            ) : succeeded ? (
              <Dialog.Close asChild><button ref={cancelRef} type="button" className="button">完成</button></Dialog.Close>
            ) : (
              <>
                <Dialog.Close asChild><button ref={cancelRef} type="button" className="button button--secondary">取消</button></Dialog.Close>
                <button type="button" className="button" onClick={onConfirm}>开始升级</button>
              </>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function dialogPhaseLabel(phase: DesktopCliUpdateSnapshot['phase']): string {
  if (phase === 'stopping-service') return '正在关闭本地服务';
  if (phase === 'installing') return '正在安装 CLI 更新';
  if (phase === 'verifying') return '正在校验升级结果';
  if (phase === 'restarting-service') return '正在恢复本地服务';
  return '正在处理升级';
}
