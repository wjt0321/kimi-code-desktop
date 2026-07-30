import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopDiffTarget } from '../../../shared/contracts';
import { DiffReviewPanel } from './DiffReviewPanel';

const target: DesktopDiffTarget = {
  id: 'call-1',
  title: 'app.ts',
  path: 'D:/repo/src/app.ts',
  lines: [
    { type: 'del', text: 'const value = 1;', oldNo: 1 },
    { type: 'add', text: 'const value = 2;', newNo: 1 },
    { type: 'context', text: 'export { value };', oldNo: 2, newNo: 2 },
  ],
};

afterEach(cleanup);

describe('DiffReviewPanel', () => {
  it('shows file stats and review actions', async () => {
    const user = userEvent.setup();
    const onCopyPath = vi.fn();
    const onCopyDiff = vi.fn();
    const onRevealPath = vi.fn();
    render(<DiffReviewPanel target={target} onClose={vi.fn()} onCopyPath={onCopyPath} onCopyDiff={onCopyDiff} onRevealPath={onRevealPath} />);

    expect(screen.getByRole('heading', { name: 'app.ts' })).not.toBeNull();
    expect(screen.getByText('+1')).not.toBeNull();
    expect(screen.getByText('-1')).not.toBeNull();
    expect(screen.getByText('const value = 2;')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '复制文件路径' }));
    await user.click(screen.getByRole('button', { name: '复制差异' }));
    await user.click(screen.getByRole('button', { name: '在资源管理器中显示' }));
    expect(onCopyPath).toHaveBeenCalledWith('D:/repo/src/app.ts');
    expect(onCopyDiff).toHaveBeenCalledWith(expect.stringContaining('+const value = 2;'));
    expect(onRevealPath).toHaveBeenCalledWith('D:/repo/src/app.ts');
  });

  it('renders fallback and truncation states', () => {
    render(<DiffReviewPanel target={{ id: 'large', title: 'large.txt', lines: [], fallbackOutput: 'changed', truncated: true }} onClose={vi.fn()} onCopyPath={vi.fn()} onCopyDiff={vi.fn()} onRevealPath={vi.fn()} />);
    expect(screen.getByText('差异过大，已显示工具输出')).not.toBeNull();
    expect(screen.getByText('changed')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '复制文件路径' })).toBeNull();
  });

  it('closes from the panel header', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DiffReviewPanel target={target} onClose={onClose} onCopyPath={vi.fn()} onCopyDiff={vi.fn()} onRevealPath={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '关闭差异审阅' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
