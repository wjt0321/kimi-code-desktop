import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopModel } from '../../../shared/contracts';
import { TaskComposer } from './TaskComposer';

afterEach(() => cleanup());

const models: DesktopModel[] = [
  { id: 'kimi-code/k3', label: 'Kimi K3', provider: 'kimi-code', contextWindow: 256000 },
  { id: 'deepseek/deepseek-v4-chat', label: 'DeepSeek V4 Chat', provider: 'deepseek' },
];

describe('TaskComposer', () => {
  it('requires a selected model and sends it with the task text', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const onModelChange = vi.fn();
    render(
      <TaskComposer
        disabled={false}
        busy={false}
        models={models}
        selectedModelId={undefined}
        onModelChange={onModelChange}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText('向 Kimi Code 发送任务'), '请检查项目');
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);

    await user.selectOptions(screen.getByLabelText('选择模型'), 'kimi-code/k3');
    expect(onModelChange).toHaveBeenCalledWith('kimi-code/k3');
  });

  it('sends with Enter but keeps Ctrl+Enter available for a newline', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(
      <TaskComposer
        disabled={false}
        busy={false}
        models={models}
        selectedModelId="kimi-code/k3"
        onModelChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText('向 Kimi Code 发送任务');

    await user.type(input, '第一行');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('第一行', 'kimi-code/k3'));

    await user.type(input, '第二行');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((input as HTMLTextAreaElement).value).toBe('第二行\n');
  });
});
