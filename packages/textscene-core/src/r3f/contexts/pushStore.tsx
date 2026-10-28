/**
 * The keyed store an AnimationPlayer pushes sampled values through to the nodes that show them
 * (ADR-0016, ADR-0017). A value changes each frame, so it reaches a node through a listener, never
 * through React state that would render the scene again. The store keeps the last value of a key, so
 * a node that mounts mid-playback starts on it.
 */

import { createContext, useContext, useRef, type ReactNode } from 'react';

type Listener<T> = (value: T | null) => void;

export interface PushStore<T> {
  /** The driver writes `value` to `key`, or `null` to release it. */
  set(key: string, value: T | null): void;
  /** Calls `listener` at once with the value written now, if any, then on every write. It answers the function that stops it. */
  subscribe(key: string, listener: Listener<T>): () => void;
}

export function createPushStore<T>(): PushStore<T> {
  /** Written only by `set`: the values written now. A release deletes the key. */
  const values = new Map<string, T>();
  const listeners = new Map<string, Set<Listener<T>>>();
  return {
    set(key, value) {
      if (value === null) values.delete(key);
      else values.set(key, value);
      listeners.get(key)?.forEach((listener) => listener(value));
    },
    subscribe(key, listener) {
      const listening = listeners.get(key) ?? new Set<Listener<T>>();
      listening.add(listener);
      listeners.set(key, listening);
      const written = values.get(key);
      if (written !== undefined) listener(written);
      return () => {
        listening.delete(listener);
      };
    },
  };
}

const NO_STORE: PushStore<never> = {
  set: () => {},
  subscribe: () => () => {},
};

/** A provider and a reader for one kind of pushed value. With no provider, the reader gets a store that reaches no one. */
export function createPushStoreContext<T>(displayName: string): {
  Provider: (props: { children: ReactNode }) => ReactNode;
  useStore: () => PushStore<T>;
} {
  const Context = createContext<PushStore<T>>(NO_STORE);
  Context.displayName = displayName;
  return {
    Provider: ({ children }) => {
      const store = useRef<PushStore<T> | null>(null);
      store.current ??= createPushStore<T>();
      return <Context.Provider value={store.current}>{children}</Context.Provider>;
    },
    useStore: () => useContext(Context),
  };
}
