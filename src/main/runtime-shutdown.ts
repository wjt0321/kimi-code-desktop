export interface RuntimeFeed {
  dispose(): void;
}

export interface RuntimeLifecycle {
  stop(): void;
}

export function createRuntimeShutdown(feed: RuntimeFeed, lifecycle: RuntimeLifecycle): () => void {
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    feed.dispose();
    lifecycle.stop();
  };
}
