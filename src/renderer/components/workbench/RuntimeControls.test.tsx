import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopModel, DesktopSessionRuntime } from '../../../shared/contracts';
import { RuntimeControls } from './RuntimeControls';

const runtime: DesktopSessionRuntime = {
  available: true,
  model: 'kimi-code/k3',
  thinkingLevel: 'high',
  permission: 'manual',
  planMode: false,
  swarmMode: false,
  contextTokens: 10,
  maxContextTokens: 100,
  contextUsage: 0.1,
  warnings: [],
};

const model: DesktopModel = {
  id: 'kimi-code/k3',
  label: 'Kimi K3',
  provider: 'kimi-code',
  supportEfforts: ['low', 'high', 'max'],
  defaultEffort: 'high',
};

afterEach(cleanup);

describe('RuntimeControls', () => {
  it('uses model-declared thinking efforts and Chinese permission descriptions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RuntimeControls runtime={runtime} model={model} disabled={false} updating={false} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /思考强度/ }));
    expect(screen.getByRole('menuitemradio', { name: /低/ })).not.toBeNull();
    expect(screen.getByRole('menuitemradio', { name: /最高/ })).not.toBeNull();
    await user.click(screen.getByRole('menuitemradio', { name: /最高/ }));
    expect(onChange).toHaveBeenCalledWith({ thinkingLevel: 'max' });

    await user.click(screen.getByRole('button', { name: /权限模式/ }));
    expect(screen.getByText('敏感操作交给用户决定')).not.toBeNull();
    expect(screen.getByText('模型自行决定，不等待审批或提问')).not.toBeNull();
  });

  it('falls back to off/on thinking and toggles only from confirmed plan state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RuntimeControls runtime={runtime} model={{ ...model, supportEfforts: undefined }} disabled={false} updating={false} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /思考强度/ }));
    expect(screen.getByRole('menuitemradio', { name: /开启/ })).not.toBeNull();
    expect(screen.queryByRole('menuitemradio', { name: /最高/ })).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('switch', { name: '计划模式' }));
    expect(onChange).toHaveBeenCalledWith({ planMode: true });
  });


  it('keeps confirmed values visible while an update is in progress', () => {
    render(<RuntimeControls runtime={runtime} model={model} disabled={false} updating onChange={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain('正在同步运行策略');
    expect(screen.getByRole('button', { name: '思考强度：高' })).not.toBeNull();
    expect((screen.getByRole('button', { name: '权限模式：手动确认' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables controls when the local CLI does not expose runtime state', () => {
    render(<RuntimeControls runtime={{ ...runtime, available: false }} model={model} disabled={false} updating={false} onChange={vi.fn()} />);
    expect(screen.getByText('当前 CLI 不支持运行策略控制')).not.toBeNull();
    expect((screen.getByRole('button', { name: /思考强度/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('switch', { name: '计划模式' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

