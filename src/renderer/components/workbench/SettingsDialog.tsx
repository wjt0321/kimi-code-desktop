import * as Dialog from '@radix-ui/react-dialog';
import { Check, Copy, ExternalLink, Keyboard, Server, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';

import type { DesktopStatus } from '../../../shared/contracts';

interface SettingsDialogProps {
  open: boolean;
  status: DesktopStatus;
  onOpenChange(open: boolean): void;
}

const upstreamUrl = 'https://github.com/MoonshotAI/kimi-code';
const projectUrl = 'https://github.com/wjt0321/kimi-code-desktop';

export function SettingsDialog({ open, status, onOpenChange }: SettingsDialogProps) {
  const [copied, setCopied] = useState<string>();
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied((current) => current === value ? undefined : current), 1_500);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="settings-dialog" aria-label="设置与关于">
          <header className="dialog-heading">
            <div><Dialog.Title>设置与关于</Dialog.Title><Dialog.Description>本机运行状态、快捷键与开源信息。</Dialog.Description></div>
            <Dialog.Close asChild><button type="button" className="icon-button" aria-label="关闭设置"><X size={16} /></button></Dialog.Close>
          </header>

          <div className="settings-grid">
            <section className="settings-section">
              <div className="settings-section__title"><Server size={16} /><span>本机运行环境</span></div>
              <dl className="settings-list">
                <div><dt>CLI</dt><dd>{status.cli.kind === 'ready' ? `已就绪 · ${status.cli.version}` : '未就绪'}</dd></div>
                <div><dt>命令</dt><dd title={status.cli.kind === 'ready' ? status.cli.command : undefined}>{status.cli.kind === 'ready' ? status.cli.command : '尚未检测到'}</dd></div>
                <div><dt>服务</dt><dd>{serverLabel(status)}</dd></div>
              </dl>
            </section>

            <section className="settings-section">
              <div className="settings-section__title"><Keyboard size={16} /><span>键盘快捷键</span></div>
              <dl className="shortcut-list">
                <div><dt>发送任务</dt><dd><kbd>Enter</kbd></dd></div>
                <div><dt>输入换行</dt><dd><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd></dd></div>
                <div><dt>命令面板</dt><dd><kbd>Ctrl</kbd><span>+</span><kbd>K</kbd></dd></div>
                <div><dt>新建任务</dt><dd><kbd>Ctrl</kbd><span>+</span><kbd>N</kbd></dd></div>
              </dl>
            </section>

            <section className="settings-section settings-section--wide">
              <div className="settings-section__title"><ShieldCheck size={16} /><span>开源与归属</span></div>
              <p className="settings-copy">这是一个由社区用户维护的非官方桌面客户端，直接使用系统安装的 Kimi Code CLI。Kimi Code 与相关品牌资源归 Moonshot AI 所有。</p>
              <div className="project-link-row">
                <div><strong>上游官方项目</strong><span>{upstreamUrl}</span></div>
                <button type="button" className="icon-button" aria-label="复制上游项目地址" onClick={() => void copy(upstreamUrl)}>{copied === upstreamUrl ? <Check size={15} /> : <Copy size={15} />}</button>
              </div>
              <div className="project-link-row">
                <div><strong>桌面端社区仓库</strong><span>{projectUrl}</span></div>
                <button type="button" className="icon-button" aria-label="复制桌面端仓库地址" onClick={() => void copy(projectUrl)}>{copied === projectUrl ? <Check size={15} /> : <Copy size={15} />}</button>
              </div>
              <p className="settings-license"><ExternalLink size={13} />桌面端源码采用 MIT License；上游资源的版权与许可见 THIRD_PARTY_NOTICES.md。</p>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function serverLabel(status: DesktopStatus): string {
  if (status.server.kind === 'connected') return '已连接本地服务';
  if (status.server.kind === 'starting') return '正在启动';
  if (status.server.kind === 'failed') return `启动失败 · ${status.server.message}`;
  return '未启动';
}
