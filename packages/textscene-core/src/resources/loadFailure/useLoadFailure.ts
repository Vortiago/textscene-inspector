import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useResourceLoader } from '../ResourceLoaderContext';
import type { LoadFailure } from './loadOutcome';

/** Null for no path, while the file loads, and while its outcome is still to load. */
export function useLoadFailure(path: string | null): LoadFailure | null {
  const loader = useResourceLoader();
  useEffect(() => {
    if (!loader || !path) return undefined;
    loader.loadOutcomes.pin(path);
    loader.loadOutcomes.request(path);
    return () => loader.loadOutcomes.unpin(path);
  }, [loader, path]);
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!loader || !path) return () => {};
      return loader.eventBus.onChange(['loadoutcome'], ({ event, key }) => {
        if (key !== path) return;
        if (event === 'invalidated') loader.loadOutcomes.request(key);
        else onChange();
      });
    },
    [loader, path]
  );
  const failure = (): LoadFailure | null => {
    const outcome = path ? loader?.loadOutcomes.getCached(path) : undefined;
    return outcome?.isFailed ? outcome : null;
  };
  return useSyncExternalStore(subscribe, failure);
}
