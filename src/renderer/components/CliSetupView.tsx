import type { CliDiscovery } from '../../shared/contracts';
import { Button } from './ui/button';

interface CliSetupViewProps {
  cli: CliDiscovery;
  onRefresh(): void;
  onChoose(): void;
}

export function CliSetupView({ cli, onRefresh, onChoose }: CliSetupViewProps) {
  const message = cli.kind === 'missing'
    ? '未在系统 PATH 中找到 Kimi Code CLI。'
    : cli.kind === 'invalid'
      ? cli.message
      : '正在检查本机的 Kimi Code CLI。';

  return (
    <main className="setup" role="status">
      <section className="setup__card">
        <p className="eyebrow">本地运行环境</p>
        <h1>连接 Kimi Code</h1>
        <p>{message}</p>
        <div className="setup__actions">
          <Button onClick={onRefresh}>重新检测</Button>
          <Button className="button--secondary" onClick={onChoose}>选择 CLI 可执行文件</Button>
        </div>
      </section>
    </main>
  );
}
