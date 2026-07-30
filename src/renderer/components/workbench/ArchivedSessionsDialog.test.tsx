import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopSession } from '../../../shared/contracts';
import { ArchivedSessionsDialog } from './ArchivedSessionsDialog';

afterEach(cleanup);

const archived: DesktopSession = {
  id: 'archived-1',
  title: '旧任务',
  updatedAt: '2026-07-28T10:00:00.000Z',
  busy: false,
  cwd: 'C:\\repo',
  lastPrompt: '检查旧版本',
};

describe('ArchivedSessionsDialog', () => {
  it('loads archived sessions only when opened', () => {
    const onLoad = vi.fn();
    const { rerender } = render(<ArchivedSessionsDialog open={false} sessions={[]} loading={false} onOpenChange={vi.fn()} onLoad={onLoad} onRestore={vi.fn()} />);
    expect(onLoad).not.toHaveBeenCalled();

    rerender(<ArchivedSessionsDialog open sessions={[]} loading onOpenChange={vi.fn()} onLoad={onLoad} onRestore={vi.fn()} />);
    expect(onLoad).toHaveBeenCalledOnce();
    expect(screen.getByText('正在读取归档任务…')).not.toBeNull();
  });

  it('does not reload when an open dialog rerenders with a new callback identity', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<ArchivedSessionsDialog open sessions={[]} loading={false} onOpenChange={vi.fn()} onLoad={first} onRestore={vi.fn()} />);
    expect(first).toHaveBeenCalledOnce();

    rerender(<ArchivedSessionsDialog open sessions={[]} loading={false} onOpenChange={vi.fn()} onLoad={second} onRestore={vi.fn()} />);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it('restores a session and closes after success', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn().mockResolvedValue(true);
    const onOpenChange = vi.fn();
    render(<ArchivedSessionsDialog open sessions={[archived]} loading={false} onOpenChange={onOpenChange} onLoad={vi.fn()} onRestore={onRestore} />);

    expect(screen.getByText('旧任务')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: '恢复任务“旧任务”' }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith('archived-1'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
