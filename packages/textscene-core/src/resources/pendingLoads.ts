/** The loads one view's consumers wait on. */
export interface PendingLoads {
  /** Counts one pending load until the returned end runs. The end is idempotent. */
  begin(): () => void;
  pending(): number;
  /** Calls `listener` at once on each change of the count. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

export function createPendingLoads(): PendingLoads {
  const listeners = new Set<() => void>();
  let count = 0;
  const change = (by: number) => {
    count += by;
    for (const listener of listeners) listener();
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
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
