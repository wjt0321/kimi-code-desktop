import {
  ArrowUpRight,
  CheckCircle2,
  Clipboard,
  LoaderCircle,
  RefreshCw,
  TerminalSquare,
  TriangleAlert,
} from 'lucide-react';

import type { DesktopCliUpdateSnapshot } from '../../../shared/contracts';

interface CliUpdateSectionProps {
  snapshot: DesktopCliUpdateSnapshot;
  onCheck(): void;
  onRequestInstall(): void;
  onCopyCommand(command: string): void;
}

export function CliUpdateSection({
  snapshot,
  onCheck,
  onRequestInstall,
  onCopyCommand,
}: CliUpdateSectionProps) {
  const presentation = updatePresentation(snapshot);
  const Icon = presentation.icon;
  const checking = snapshot.phase === 'checking';
  const busy = ['stopping-service', 'installing', 'verifying', 'restarting-service'].includes(snapshot.phase);

  return (
    <section className="settings-section settings-section--wide cli-update-section">
      <div className="settings-section__title-row">
        <div className="settings-section__title"><ArrowUpRight size={16} /><span>CLI 更新</span></div>
        <button type="button" className="settings-refresh" disabled={checking || busy} onClick={onCheck}>
          <RefreshCw size={12} className={checking ? 'spin' : undefined} />
          {checking ? '检查中' : '检查更新'}
        </button>
      </div>

      <div className={`cli-update-card cli-update-card--${presentation.tone}`}>
        <span className="cli-update-card__icon"><Icon size={17} className={presentation.spinning ? 'spin' : undefined} /></span>
        <div className="cli-update-card__copy">
          <strong>{presentation.title}</strong>
          <p>{presentation.detail}</p>
        </div>
        <div className="cli-update-card__versions" aria-label="CLI 版本">
          <span><small>当前</small><strong>{snapshot.currentVersion ?? '—'}</strong></span>
          <span className="cli-update-card__arrow">→</span>
          <span><small>最新</small><strong>{snapshot.latestVersion ?? '—'}</strong></span>
        </div>
      </div>

      {snapshot.error ? <p className="cli-update-error" role="status"><TriangleAlert size={13} />{snapshot.error}</p> : null}
      {snapshot.detail && snapshot.phase === 'failed' ? <pre className="cli-update-detail">{snapshot.detail}</pre> : null}

      {snapshot.updateAvailable ? (
        <div className="cli-update-actions">
          <div>
            <span>{installSourceLabel(snapshot.installSource)}</span>
            <code>{snapshot.installCommand ?? 'kimi upgrade'}</code>
          </div>
          {snapshot.canAutoInstall ? (
            <button type="button" className="button" onClick={onRequestInstall}>升级到 {snapshot.latestVersion}</button>
          ) : (
            <button type="button" className="button button--secondary" onClick={() => onCopyCommand(snapshot.installCommand ?? 'kimi upgrade')}><Clipboard size={13} />复制手动升级命令</button>
          )}
        </div>
      ) : null}
    </section>
  );
}

function updatePresentation(snapshot: DesktopCliUpdateSnapshot) {
  if (snapshot.phase === 'checking') return { title: '正在检查更新', detail: '正在读取 Kimi Code 官方稳定版信息。', tone: 'progress', icon: LoaderCircle, spinning: true } as const;
  if (snapshot.phase === 'available') return { title: `发现 Kimi Code CLI ${snapshot.latestVersion ?? '新版本'}`, detail: '升级前会显示将要执行的命令，并在需要时恢复本地服务。', tone: 'available', icon: ArrowUpRight, spinning: false } as const;
  if (snapshot.phase === 'succeeded') return { title: 'CLI 升级完成', detail: `当前版本 ${snapshot.currentVersion ?? '已更新'}，本地能力会自动重新检测。`, tone: 'success', icon: CheckCircle2, spinning: false } as const;
  if (snapshot.phase === 'failed') return { title: 'CLI 更新未完成', detail: '没有修改桌面端配置，你可以重试或使用手动命令。', tone: 'error', icon: TriangleAlert, spinning: false } as const;
  if (['stopping-service', 'installing', 'verifying', 'restarting-service'].includes(snapshot.phase)) return { title: '正在执行 CLI 升级', detail: phaseDetail(snapshot.phase), tone: 'progress', icon: LoaderCircle, spinning: true } as const;
  return { title: '已是最新版本', detail: '桌面端会每天自动检查一次，也可以随时手动检查。', tone: 'current', icon: CheckCircle2, spinning: false } as const;
}

function phaseDetail(phase: DesktopCliUpdateSnapshot['phase']): string {
  if (phase === 'stopping-service') return '正在安全关闭由桌面端启动的本地服务。';
  if (phase === 'installing') return '正在通过原安装来源更新 Kimi Code CLI。';
  if (phase === 'verifying') return '正在重新检测 CLI 并校验版本。';
  if (phase === 'restarting-service') return '正在恢复升级前运行的本地服务。';
  return '正在处理更新。';
}

export function installSourceLabel(source: DesktopCliUpdateSnapshot['installSource']): string {
  if (source === 'npm-global') return 'npm 全局安装';
  if (source === 'pnpm-global') return 'pnpm 全局安装';
  if (source === 'yarn-global') return 'Yarn 全局安装';
  if (source === 'bun-global') return 'Bun 全局安装';
  if (source === 'native') return '原生安装';
  return '未识别安装来源';
}
