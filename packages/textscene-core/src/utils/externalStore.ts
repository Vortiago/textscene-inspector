export interface ExternalStore<T> {
  /** Safe to call during render. */
  get(): T;
  /** An `Object.is`-equal value notifies nobody. A throwing subscriber stops none of the others. */
  set(value: T): void;
  /** Returns the unsubscribe function. */
  subscribe(onStoreChange: () => void): () => void;
}

/**
 * @canonical A value that changes often and that few components read
 */
export function createExternalStore<T>(initial: T): ExternalStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      notifyAll(listeners);
    },
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
  };
}

function notifyAll(listeners: ReadonlySet<() => void>): void {
  const failures: unknown[] = [];
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw failures[0];
}
