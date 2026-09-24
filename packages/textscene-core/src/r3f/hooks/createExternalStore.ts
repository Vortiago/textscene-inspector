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
  /** A value `Object.is`-equal to the current one is a no-op and notifies nobody. */
  set(value: T): void;
  /** Returns the unsubscribe function. */
  subscribe(onStoreChange: () => void): () => void;
}

export function createExternalStore<T>(initial: T): ExternalStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
  };
}

/** Subscribes the calling component to an {@link ExternalStore}'s value. */
export function useExternalStoreValue<T>(store: ExternalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
