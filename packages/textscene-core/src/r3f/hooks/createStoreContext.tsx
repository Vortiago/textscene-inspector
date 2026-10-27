/**
 * A React Context that carries an external store from the component that writes it to the one
 * that reads it. The context value never changes, so a write re-renders only the value's readers.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createExternalStore, useExternalStoreValue, type ExternalStore } from './createExternalStore.js';

export interface StoreContext<T> {
  /** Holds a store of its own, so two previews never share a value. */
  Provider: (props: { children: ReactNode }) => ReactNode;
  /** The store a writer sets. */
  useStore: () => ExternalStore<T>;
  /** The store's value, re-rendering the caller when it changes. */
  useValue: () => T;
}

/**
 * A store context whose stores start at `initial`. Without a provider, a writer sets a stand-in
 * store that nothing reads.
 *
 * @oneWay A React context that holds a store
 */
export function createStoreContext<T>(initial: T, displayName: string): StoreContext<T> {
  const Context = createContext<ExternalStore<T>>(createExternalStore(initial));
  Context.displayName = displayName;

  function Provider({ children }: { children: ReactNode }) {
    const [store] = useState(() => createExternalStore(initial));
    return <Context.Provider value={store}>{children}</Context.Provider>;
  }

  const useStore = (): ExternalStore<T> => useContext(Context);
  return { Provider, useStore, useValue: () => useExternalStoreValue(useStore()) };
}
