import { describe, expect, it, vi } from 'vitest';

import { createRuntimeShutdown } from './runtime-shutdown';

describe('createRuntimeShutdown', () => {
  it('stops the task feed and CLI service only once when the window closes', () => {
    const feed = { dispose: vi.fn() };
    const lifecycle = { stop: vi.fn() };
    const shutdown = createRuntimeShutdown(feed, lifecycle);

    shutdown();
    shutdown();

    expect(feed.dispose).toHaveBeenCalledOnce();
    expect(lifecycle.stop).toHaveBeenCalledOnce();
  });
});
