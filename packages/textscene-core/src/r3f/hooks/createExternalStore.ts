/**
 * One mutable value and its subscribers, read through `useSyncExternalStore`, so a change
 * re-renders only the components that subscribe. On a React Context, every consumer re-renders on
 * any change. It holds high-frequency state with few readers, such as `hoveredNodePath`, which
 * only `<HoverHighlight>` reads.
 */
import { useSyncExternalStore } from 'react';

export interface ExternalStore<T> {
  /** Safe to call during render. */
  get(): T;
  /**
   * A value `Object.is`-equal to the current one is a no-op and notifies nobody. A throwing
   * subscriber does not stop the later ones, so none misses the change: the first error is rethrown
   * once all have run.
   */
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

/**
 * Subscribes the calling component to an {@link ExternalStore}'s value.
 *
 * @canonical A value that changes often and that few components read
 */
export function useExternalStoreValue<T>(store: ExternalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
