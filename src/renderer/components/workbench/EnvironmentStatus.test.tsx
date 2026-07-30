import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WorkbenchStatusSummary } from './workbench-status';
import { EnvironmentStatus } from './EnvironmentStatus';

const idleSummary: WorkbenchStatusSummary = {
  cli: { label: 'Kimi CLI 已就绪', detail: '版本 0.30.0', tone: 'ready' },
  service: { label: '服务未启动', detail: '启动后即可创建和执行任务', tone: 'neutral', action: 'start-service' },
  task: { label: '等待开始', detail: '打开工作区后创建一个任务', tone: 'neutral' },
};

describe('EnvironmentStatus', () => {
  it('renders readable CLI, service, and task states with the available action', async () => {
    const user = userEvent.setup();
    const start = vi.fn();
    render(<EnvironmentStatus summary={idleSummary} onStart={start} onChooseCli={vi.fn()} onOpenContext={vi.fn()} />);

    expect(screen.getByText('Kimi CLI 已就绪')).not.toBeNull();
    expect(screen.getByText('服务未启动')).not.toBeNull();
    expect(screen.getByText('等待开始')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: '启动本地服务' }));
    expect(start).toHaveBeenCalledOnce();
  });

  it('shows pending task context as an explicit action', async () => {
    const user = userEvent.setup();
    const openContext = vi.fn();
    render(<EnvironmentStatus summary={{
      ...idleSummary,
      service: { label: '本机服务已连接', detail: '正在使用本地服务', tone: 'ready' },
      task: { label: '等待你的审批', detail: '有 1 项操作需要确认', tone: 'attention', action: 'open-context' },
    }} onStart={vi.fn()} onChooseCli={vi.fn()} onOpenContext={openContext} />);

    expect(screen.getByText('等待你的审批')).not.toBeNull();
    expect(screen.getByText('有 1 项操作需要确认')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: '处理待处理项' }));
    expect(openContext).toHaveBeenCalledOnce();
  });
});
