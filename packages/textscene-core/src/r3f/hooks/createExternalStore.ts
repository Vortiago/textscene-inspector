import { useSyncExternalStore } from 'react';
import type { ExternalStore } from '../../utils/externalStore.js';

/**
 * Subscribes the calling component to an {@link ExternalStore}'s value.
 *
 * @canonical A value that changes often and that few components read
 */
export function useExternalStoreValue<T>(store: ExternalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/**
 * Subscribes the calling component to the part of an {@link ExternalStore}'s value that `select`
 * picks, so a change elsewhere in the value renders nothing. `select` returns a value already in
 * the store, or a primitive, so an unchanged pick is `Object.is`-equal.
 *
 * @canonical A value that changes often and that few components read
 */
export function useExternalStoreSelection<T, S>(store: ExternalStore<T>, select: (value: T) => S): S {
  const pick = () => select(store.get());
  return useSyncExternalStore(store.subscribe, pick, pick);
}
