/**
 * A minimal ref-based external store: a single mutable value plus a
 * subscriber set, read via `useSyncExternalStore` so only the component that
 * actually subscribes re-renders on a change — unlike a value carried on a
 * broader React Context, where EVERY consumer of that context re-renders on
 * ANY change to it regardless of which field it reads.
 *
 * Used for state that changes at high frequency but has few (often exactly
 * one) real readers — e.g. `hoveredNodePath`, which `TreeNode.tsx` and the
 * viewport's pointer handlers only ever WRITE, while `<HoverHighlight>` is
 * the sole reader. Putting it on `SelectionContext` directly meant every
 * selection consumer (every node wrapper, every tree row) re-rendered on
 * every hover change.
 */
import { useSyncExternalStore } from 'react';

export interface ExternalStore<T> {
  /** Current value. Safe to call during render. */
  get(): T;
  /** Update the value; no-ops (and skips notifying subscribers) if `Object.is`-equal to the current value. */
  set(value: T): void;
  /** Register a change listener; returns an unsubscribe function. */
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
