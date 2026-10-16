/** How many resources the nearest loader still waits for, as React state. Zero outside a loader. */
import { useCallback, useSyncExternalStore } from 'react';
import { useResourceLoader } from './useResource.js';

export function usePendingResourceCount(): number {
  const loader = useResourceLoader();
  const subscribe = useCallback(
    (listener: () => void) => (loader ? loader.subscribePending(listener) : () => {}),
    [loader]
  );
  return useSyncExternalStore(subscribe, () => loader?.pendingResourceCount ?? 0);
}
