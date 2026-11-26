import { createExternalStore } from '../utils/externalStore.js';

export interface WorkCount {
  /** Counts one piece of work until the returned end runs. The end is idempotent. */
  begin(): () => void;
  pending(): number;
  /** Calls `onChange` after a change of the count, as the factory states. Returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

/** @canonical A count of work in flight, whose subscribers hear a change a microtask later */
export function createWorkCount(): WorkCount {
  const notices = createExternalStore(0);
  let isNoticeQueued = false;
  // Work starts inside a React render, so the subscribers hear a microtask later, never mid-render.
  const notify = () => {
    if (isNoticeQueued) return;
    isNoticeQueued = true;
    queueMicrotask(() => {
      isNoticeQueued = false;
      notices.set(notices.get() + 1);
    });
  };
  return countNotifying(notify, notices.subscribe);
}

/** Subscribers hear each change at once, so a load that starts and ends in one task is heard. */
export function createImmediateWorkCount(): WorkCount {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return countNotifying(notify, (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
}

function countNotifying(notify: () => void, subscribe: WorkCount['subscribe']): WorkCount {
  let count = 0;
  const change = (by: number) => {
    count += by;
    notify();
  };
  return {
    begin() {
      change(1);
      let isEnded = false;
      return () => {
        if (isEnded) return;
        isEnded = true;
        change(-1);
      };
    },
    pending: () => count,
    subscribe,
  };
}
