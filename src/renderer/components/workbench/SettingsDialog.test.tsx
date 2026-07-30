import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopCapabilitySnapshot, DesktopStatus } from '../../../shared/contracts';
import { SettingsDialog } from './SettingsDialog';

const status: DesktopStatus = {
  cli: { kind: 'ready', command: 'C:\\tools\\kimi.cmd', version: '0.30.0' },
  server: { kind: 'connected', origin: 'http://127.0.0.1:58627' },
};

const capabilities: DesktopCapabilitySnapshot = {
  phase: 'ready',
  desktopVersion: '0.5.0',
  cliVersion: '0.30.0',
  serverVersion: '0.30.0',
  checkedAt: '2026-07-30T08:00:00.000Z',
  compatibilityMode: true,
  capabilities: {
    sessionRuntime: 'supported',
    sessionWarnings: 'supported',
    transcript: 'supported',
    config: 'supported',
    secondaryModel: 'unsupported',
    managedUserInfo: 'unsupported',
    promptProfile: 'unsupported',
    nonBlockingTaskOutput: 'unsupported',
  },
};

afterEach(() => cleanup());

describe('SettingsDialog compatibility presentation', () => {
  it('presents CLI 0.30 as a compatible mode instead of an error', () => {
    render(
      <SettingsDialog
        open
        status={status}
        capabilities={capabilities}
        onRefreshCapabilities={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/已启用兼容模式/)).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText('当前版本未提供').length).toBeGreaterThan(0);
    expect(screen.getByText('桌面端 0.5.0')).not.toBeNull();
  });

  it('shows detecting and supported capability states', () => {
    const { rerender } = render(
      <SettingsDialog
        open
        status={status}
        capabilities={{ ...capabilities, phase: 'detecting' }}
        onRefreshCapabilities={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText('正在检测').length).toBeGreaterThan(0);

    rerender(
      <SettingsDialog
        open
        status={status}
        capabilities={{
          ...capabilities,
          compatibilityMode: false,
          cliVersion: '0.31.1',
          capabilities: Object.fromEntries(
            Object.keys(capabilities.capabilities).map((key) => [key, 'supported']),
          ) as DesktopCapabilitySnapshot['capabilities'],
        }}
        onRefreshCapabilities={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText('已可用').length).toBeGreaterThan(0);
  });

  it('checks for CLI updates and opens the branded confirmation flow', async () => {
    const check = vi.fn();
    const install = vi.fn();
    render(
      <SettingsDialog
        open
        status={status}
        capabilities={capabilities}
        cliUpdate={{
          phase: 'available',
          currentVersion: '0.30.0',
          latestVersion: '0.31.0',
          installSource: 'npm-global',
          installCommand: 'npm install --global @moonshot-ai/kimi-code@0.31.0',
          canAutoInstall: true,
          updateAvailable: true,
        }}
        onCheckCliUpdate={check}
        onInstallCliUpdate={install}
        onRefreshCapabilities={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '检查更新' }));
    expect(check).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '升级到 0.31.0' }));
    expect(screen.getByRole('dialog', { name: '确认升级 CLI' })).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '开始升级' }));
    expect(install).toHaveBeenCalledOnce();
  });

});

