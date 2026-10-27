/**
 * A page-wide count of work in flight, with its subscribers. A preview status reads it to show that
 * something is still loading, and a capture harness waits for that status to detach.
 */
import { createExternalStore } from '../r3f/hooks/createExternalStore.js';

export interface WorkCount {
  /** Counts one piece of work until the returned end runs. The end is idempotent. */
  begin(): () => void;
  pending(): number;
  /** Calls `onChange` on every change of the count. Returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

/** @canonical A page-wide count of work in flight */
export function createWorkCount(): WorkCount {
  const store = createExternalStore(0);
  return {
    begin() {
      store.set(store.get() + 1);
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        store.set(store.get() - 1);
      };
    },
    pending: store.get,
    subscribe: store.subscribe,
  };
}
