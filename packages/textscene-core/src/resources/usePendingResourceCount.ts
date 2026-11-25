import { useSyncExternalStore } from 'react';
import { usePendingLoads } from './ResourceLoaderContext.js';
import { subscribeToNothing } from '../utils/subscribeToNothing.js';

/** How many loads the nearest provider's consumers still wait for, as React state. Zero outside one. */
export function usePendingResourceCount(): number {
  const pending = usePendingLoads();
  return useSyncExternalStore(pending?.subscribe ?? subscribeToNothing, () => pending?.pending() ?? 0);
}
