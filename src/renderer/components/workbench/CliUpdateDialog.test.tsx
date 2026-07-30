import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DesktopCliUpdateSnapshot } from '../../../shared/contracts';
import { CliUpdateDialog } from './CliUpdateDialog';

const available: DesktopCliUpdateSnapshot = {
  phase: 'available',
  currentVersion: '0.30.0',
  latestVersion: '0.31.0',
  installSource: 'npm-global',
  installCommand: 'npm install --global @moonshot-ai/kimi-code@0.31.0',
  canAutoInstall: true,
  updateAvailable: true,
};

describe('CliUpdateDialog', () => {
  it('shows the exact update plan and starts only after confirmation', async () => {
    const confirm = vi.fn();
    render(<CliUpdateDialog open snapshot={available} serviceActive onConfirm={confirm} onOpenChange={vi.fn()} />);

    expect(screen.getByText('0.30.0')).not.toBeNull();
    expect(screen.getByText('0.31.0')).not.toBeNull();
    expect(screen.getByText('npm 全局安装')).not.toBeNull();
    expect(screen.getByText('npm install --global @moonshot-ai/kimi-code@0.31.0')).not.toBeNull();
    expect(screen.getByText(/本地服务会先安全关闭/)).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '取消' }));

    await userEvent.click(screen.getByRole('button', { name: '开始升级' }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('locks destructive controls while the package manager is running', () => {
    render(<CliUpdateDialog open snapshot={{ ...available, phase: 'installing' }} serviceActive onConfirm={vi.fn()} onOpenChange={vi.fn()} />);
    expect(screen.getByText('正在安装 CLI 更新')).not.toBeNull();
    expect((screen.getByRole('button', { name: '正在升级' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: '取消' })).toBeNull();
  });
});

