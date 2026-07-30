import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createCloseRequestController, resolveWindowIconPath } from './window-behavior';

describe('window behavior', () => {
  it('asks the renderer to confirm and only closes after renderer confirmation', () => {
    const requestConfirmation = vi.fn();
    const close = vi.fn();
    const controller = createCloseRequestController(requestConfirmation, close);
    const firstEvent = { preventDefault: vi.fn() };

    controller.handleClose(firstEvent);

    expect(firstEvent.preventDefault).toHaveBeenCalledOnce();
    expect(requestConfirmation).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();

    controller.confirmClose();
    expect(close).toHaveBeenCalledOnce();

    const finalEvent = { preventDefault: vi.fn() };
    controller.handleClose(finalEvent);
    expect(finalEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('uses the packaged extra resource for the runtime window icon', () => {
    expect(resolveWindowIconPath(true, 'C:\\app\\resources', 'C:\\project\\dist\\main')).toBe(join('C:\\app\\resources', 'kimi-code.ico'));
    expect(resolveWindowIconPath(false, 'C:\\app\\resources', 'C:\\project\\dist\\main')).toBe(join('C:\\project\\dist\\main', '../../build/kimi-code.ico'));
  });
});
