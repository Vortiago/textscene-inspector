/**
 * A page-wide count of work in flight, with its subscribers. A preview status reads it to show that
 * something is still loading, and a capture harness waits for that status to detach.
 */
import { createExternalStore } from '../r3f/hooks/createExternalStore.js';

export interface WorkCount {
  /** Counts one piece of work until the returned end runs. The end is idempotent. */
  begin(): () => void;
  pending(): number;
  /** Calls `onChange` a microtask after each task that changes the count. Returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

/** @canonical A page-wide count of work in flight */
export function createWorkCount(): WorkCount {
  const notices = createExternalStore(0);
  let count = 0;
  let isNoticeQueued = false;
  // Work starts inside a React render, so the subscribers hear a microtask later, never mid-render.
  const change = (by: number) => {
    count += by;
    if (isNoticeQueued) return;
    isNoticeQueued = true;
    queueMicrotask(() => {
      isNoticeQueued = false;
      notices.set(notices.get() + 1);
    });
  };
  return {
    begin() {
      change(1);
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        change(-1);
      };
    },
    pending: () => count,
    subscribe: notices.subscribe,
  };
}
