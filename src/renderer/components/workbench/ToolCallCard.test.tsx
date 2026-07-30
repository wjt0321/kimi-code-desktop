import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopTimelineToolEntry } from '../../../shared/contracts';
import { ToolCallCard } from './ToolCallCard';

const shellEntry: DesktopTimelineToolEntry = {
  id: 'frame-1',
  kind: 'tool',
  toolCallId: 'call-1',
  name: 'Shell',
  category: 'shell',
  state: 'running',
  title: '运行命令',
  summary: 'pnpm test',
  command: 'pnpm test',
  cwd: 'D:/repo',
  progress: { kind: 'progress', text: '正在执行测试', percent: 50 },
  input: { type: 'object', entries: [{ key: 'command', value: 'pnpm test' }] },
};

afterEach(cleanup);

describe('ToolCallCard', () => {
  it('renders a running shell with status, progress and details', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard entry={shellEntry} onOpenDiff={vi.fn()} onOpenTask={vi.fn()} />);

    expect(screen.getByText('运行命令')).not.toBeNull();
    expect(screen.getAllByText('pnpm test').length).toBeGreaterThan(0);
    expect(screen.getByText('运行中')).not.toBeNull();
    expect(screen.getByText('50%')).not.toBeNull();
    expect(screen.getByText('D:/repo')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /收起运行命令详情/ }));
    expect(screen.queryByText('D:/repo')).toBeNull();
  });

  it('keeps completed tools collapsed and opens their structured result', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard entry={{ ...shellEntry, state: 'done', progress: undefined, output: { type: 'object', entries: [{ key: 'ok', value: true }] } }} onOpenDiff={vi.fn()} onOpenTask={vi.fn()} />);
    expect(screen.queryByText('ok')).toBeNull();
    await user.click(screen.getByRole('button', { name: /展开运行命令详情/ }));
    expect(screen.getByText('ok')).not.toBeNull();
    expect(screen.getByText('已完成')).not.toBeNull();
  });

  it('opens diff and task targets without toggling the card', async () => {
    const user = userEvent.setup();
    const onOpenDiff = vi.fn();
    const onOpenTask = vi.fn();
    const diff = { id: 'call-1', title: 'app.ts', path: 'D:/repo/app.ts', lines: [{ type: 'add' as const, text: 'x', newNo: 1 }] };
    render(<ToolCallCard entry={{ ...shellEntry, state: 'done', diff, taskId: 'task-1' }} onOpenDiff={onOpenDiff} onOpenTask={onOpenTask} />);

    await user.click(screen.getByRole('button', { name: /展开运行命令详情/ }));
    await user.click(screen.getByRole('button', { name: '查看完整差异' }));
    await user.click(screen.getByRole('button', { name: '查看后台任务' }));
    expect(onOpenDiff).toHaveBeenCalledWith(diff);
    expect(onOpenTask).toHaveBeenCalledWith('task-1');
  });

  it('renders generic tools and failures safely', () => {
    render(<ToolCallCard entry={{ id: 'f', kind: 'tool', name: 'FutureTool', category: 'generic', state: 'error', title: 'FutureTool', summary: '失败', error: 'boom' }} onOpenDiff={vi.fn()} onOpenTask={vi.fn()} />);
    expect(screen.getByText('FutureTool')).not.toBeNull();
    expect(screen.getAllByText('失败').length).toBeGreaterThan(0);
    expect(screen.getByText('boom')).not.toBeNull();
  });

  it('shows subordinate agent references with localized roles', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard entry={{ ...shellEntry, id: 'agent-tool', state: 'done', category: 'agent', title: '并行检查', agentRefs: [{ agentId: 'agent-child', role: 'child' }, { agentId: 'agent-member', role: 'member' }] }} onOpenDiff={vi.fn()} onOpenTask={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '展开并行检查详情' }));
    expect(screen.getAllByText('子 Agent').length).toBeGreaterThan(0);
    expect(screen.getByText('Agent 成员')).not.toBeNull();
    expect(screen.getByText('agent-child')).not.toBeNull();
  });
});
