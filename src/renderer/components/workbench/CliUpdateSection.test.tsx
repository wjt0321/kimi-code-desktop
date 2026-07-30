import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DesktopCliUpdateSnapshot } from '../../../shared/contracts';
import { CliUpdateSection } from './CliUpdateSection';

const available: DesktopCliUpdateSnapshot = {
  phase: 'available',
  currentVersion: '0.30.0',
  latestVersion: '0.31.0',
  installSource: 'npm-global',
  installCommand: 'npm install --global @moonshot-ai/kimi-code@0.31.0',
  canAutoInstall: true,
  updateAvailable: true,
};

describe('CliUpdateSection', () => {
  it('shows an available update and requests confirmation before installation', async () => {
    const requestInstall = vi.fn();
    render(<CliUpdateSection snapshot={available} onCheck={vi.fn()} onRequestInstall={requestInstall} onCopyCommand={vi.fn()} />);

    expect(screen.getByText('0.30.0')).not.toBeNull();
    expect(screen.getByText('0.31.0')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '升级到 0.31.0' }));
    expect(requestInstall).toHaveBeenCalledOnce();
  });

  it('offers a manual command for unsupported installation sources', async () => {
    const copyCommand = vi.fn();
    render(
      <CliUpdateSection
        snapshot={{ ...available, installSource: 'unsupported', canAutoInstall: false, installCommand: 'kimi upgrade' }}
        onCheck={vi.fn()}
        onRequestInstall={vi.fn()}
        onCopyCommand={copyCommand}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '复制手动升级命令' }));
    expect(copyCommand).toHaveBeenCalledWith('kimi upgrade');
  });

  it('presents checking, current and failed states in Chinese', () => {
    const { rerender } = render(
      <CliUpdateSection
        snapshot={{ phase: 'checking', currentVersion: '0.30.0', canAutoInstall: false, updateAvailable: false }}
        onCheck={vi.fn()}
        onRequestInstall={vi.fn()}
        onCopyCommand={vi.fn()}
      />,
    );
    expect(screen.getByText('正在检查更新')).not.toBeNull();

    rerender(<CliUpdateSection snapshot={{ phase: 'current', currentVersion: '0.30.0', latestVersion: '0.30.0', canAutoInstall: false, updateAvailable: false }} onCheck={vi.fn()} onRequestInstall={vi.fn()} onCopyCommand={vi.fn()} />);
    expect(screen.getByText('已是最新版本')).not.toBeNull();

    rerender(<CliUpdateSection snapshot={{ phase: 'failed', currentVersion: '0.30.0', canAutoInstall: false, updateAvailable: false, error: '暂时无法检查 CLI 更新。' }} onCheck={vi.fn()} onRequestInstall={vi.fn()} onCopyCommand={vi.fn()} />);
    expect(screen.getByText('暂时无法检查 CLI 更新。')).not.toBeNull();
  });
});
