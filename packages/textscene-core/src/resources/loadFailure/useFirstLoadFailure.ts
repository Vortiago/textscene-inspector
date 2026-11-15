/** The first of a set of files that Godot fails to load, with each file's outcome requested and held. */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useResourceLoader } from '../useResource';
import type { LoadOutcome } from './loadOutcome';

type Failure = Extract<LoadOutcome, { isFailed: true }>;

/** Null while every file loads or its outcome is still to load. `paths` keeps its identity across renders. */
export function useFirstLoadFailure(paths: readonly string[]): Failure | null {
  const loader = useResourceLoader();
  useEffect(() => {
    if (!loader) return undefined;
    const outcomes = loader.loadOutcomes;
    paths.forEach((path) => {
      outcomes.pin(path);
      outcomes.request(path);
    });
    return () => paths.forEach((path) => outcomes.unpin(path));
  }, [loader, paths]);
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!loader) return () => {};
      return loader.eventBus.onChange(['loadoutcome'], ({ event, key }) => {
        if (!paths.includes(key)) return;
        if (event === 'invalidated') loader.loadOutcomes.request(key);
        else onChange();
      });
    },
    [loader, paths]
  );
  const firstFailure = (): Failure | null => {
    for (const path of paths) {
      const outcome = loader?.loadOutcomes.getCached(path);
      if (outcome?.isFailed) return outcome;
    }
    return null;
  };
  return useSyncExternalStore(subscribe, firstFailure);
}
