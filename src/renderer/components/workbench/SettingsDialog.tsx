import * as Dialog from '@radix-ui/react-dialog';
import {
  BadgeCheck,
  Check,
  CircleHelp,
  Copy,
  ExternalLink,
  Keyboard,
  Palette,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { ThemeControl } from './ThemeControl';

import type { DesktopCapabilitySnapshot, DesktopCapabilityState, DesktopStatus, DesktopThemeSnapshot, ThemePreference } from '../../../shared/contracts';

interface SettingsDialogProps {
  open: boolean;
  status: DesktopStatus;
  capabilities: DesktopCapabilitySnapshot;
  theme?: DesktopThemeSnapshot;
  onThemeChange?(preference: ThemePreference): void;
  onRefreshCapabilities(): void;
  onOpenChange(open: boolean): void;
}

const upstreamUrl = 'https://github.com/MoonshotAI/kimi-code';
const projectUrl = 'https://github.com/wjt0321/kimi-code-desktop';

export function SettingsDialog({ open, status, capabilities, theme = { preference: 'system', resolved: 'dark' }, onThemeChange = () => {}, onRefreshCapabilities, onOpenChange }: SettingsDialogProps) {
  const [copied, setCopied] = useState<string>();
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied((current) => current === value ? undefined : current), 1_500);
  };
  const capabilityGroups = [
    { label: '会话运行控制', description: '模型、思考强度与权限策略', state: capabilities.capabilities.sessionRuntime },
    { label: '结构化任务过程', description: '工具调用、审批与任务时间线', state: capabilities.capabilities.transcript },
    { label: '后台任务通知', description: '后台任务快照与完成通知', state: capabilities.capabilities.nonBlockingTaskOutput },
    { label: '新版扩展能力', description: '副模型、账号资料与 Agent Profile', state: extensionState(capabilities) },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="settings-dialog" aria-label="设置与关于">
          <header className="dialog-heading">
            <div><Dialog.Title>设置与关于</Dialog.Title><Dialog.Description>版本兼容、键盘操作与开源归属。</Dialog.Description></div>
            <Dialog.Close asChild><button type="button" className="icon-button" aria-label="关闭设置"><X size={16} /></button></Dialog.Close>
          </header>

          <div className="settings-grid">
            <section className="settings-section settings-section--appearance">
              <div className="settings-section__title"><Palette size={16} /><span>外观</span></div>
              <p className="settings-copy">选择浅色、深色，或跟随 Windows 系统主题实时变化。</p>
              <ThemeControl theme={theme} onChange={onThemeChange} />
            </section>
            <section className="settings-section settings-section--compatibility">
              <div className="settings-section__title-row">
                <div className="settings-section__title"><Server size={16} /><span>版本与兼容性</span></div>
                <button
                  type="button"
                  className="settings-refresh"
                  disabled={capabilities.phase === 'detecting'}
                  onClick={onRefreshCapabilities}
                >
                  <RefreshCw size={12} className={capabilities.phase === 'detecting' ? 'spin' : undefined} />
                  {capabilities.phase === 'detecting' ? '检测中' : '重新检测'}
                </button>
              </div>

              <div className={`compatibility-card compatibility-card--${capabilities.compatibilityMode ? 'compat' : 'current'}`}>
                <span className="compatibility-card__icon">{capabilities.compatibilityMode ? <Layers3 size={16} /> : <BadgeCheck size={16} />}</span>
                <div>
                  <strong>{capabilities.compatibilityMode ? '已启用兼容模式' : '当前 CLI 支持新版能力'}</strong>
                  <p>{compatibilityCopy(capabilities)}</p>
                </div>
              </div>

              <dl className="settings-list settings-list--versions">
                <div><dt>桌面端</dt><dd>桌面端 {capabilities.desktopVersion}</dd></div>
                <div><dt>系统 CLI</dt><dd>{status.cli.kind === 'ready' ? status.cli.version : capabilities.cliVersion ?? '未检测到'}</dd></div>
                <div><dt>本地服务</dt><dd>{capabilities.serverVersion ?? serverLabel(status)}</dd></div>
                <div><dt>CLI 命令</dt><dd title={status.cli.kind === 'ready' ? status.cli.command : undefined}>{status.cli.kind === 'ready' ? status.cli.command : '尚未检测到'}</dd></div>
              </dl>

              <div className="capability-list" aria-label="本地服务能力">
                {capabilityGroups.map((item) => {
                  const presentation = capabilityPresentation(item.state, capabilities.phase);
                  const Icon = presentation.icon;
                  return (
                    <div className="capability-row" key={item.label}>
                      <span className={`capability-row__icon capability-state--${presentation.tone}`}><Icon size={13} className={presentation.spinning ? 'spin' : undefined} /></span>
                      <span className="capability-row__copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                      <span className={`capability-row__state capability-state--${presentation.tone}`}>{presentation.label}</span>
                    </div>
                  );
                })}
              </div>
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

function extensionState(snapshot: DesktopCapabilitySnapshot): DesktopCapabilityState {
  const states = [
    snapshot.capabilities.secondaryModel,
    snapshot.capabilities.managedUserInfo,
    snapshot.capabilities.promptProfile,
  ];
  if (states.some((state) => state === 'supported')) return 'supported';
  if (states.some((state) => state === 'unknown')) return 'unknown';
  return 'unsupported';
}

function capabilityPresentation(state: DesktopCapabilityState, phase: DesktopCapabilitySnapshot['phase']) {
  if (phase === 'detecting') return { label: '正在检测', tone: 'unknown', icon: LoaderCircle, spinning: true };
  if (state === 'supported') return { label: '已可用', tone: 'supported', icon: BadgeCheck, spinning: false };
  if (state === 'unsupported') return { label: '当前版本未提供', tone: 'unsupported', icon: Sparkles, spinning: false };
  return { label: '暂未确认', tone: 'unknown', icon: CircleHelp, spinning: false };
}

function compatibilityCopy(snapshot: DesktopCapabilitySnapshot): string {
  if (snapshot.phase === 'detecting') return '正在读取本地服务能力，不会修改你的 CLI 配置。';
  if (snapshot.compatibilityMode) return `当前使用 Kimi Code CLI ${snapshot.cliVersion ?? '0.30'}，现有任务功能可以正常使用；新版能力会在升级后自动出现。`;
  return '桌面端会根据本地服务的实际能力渐进显示功能，不依赖固定版本假设。';
}

function serverLabel(status: DesktopStatus): string {
  if (status.server.kind === 'connected') return '已连接本地服务';
  if (status.server.kind === 'starting') return '正在启动';
  if (status.server.kind === 'failed') return `启动失败 · ${status.server.message}`;
  return '未启动';
}
