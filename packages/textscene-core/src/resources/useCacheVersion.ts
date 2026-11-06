/**
 * A version number for a reader that reads the loader's caches directly instead of
 * through `useResource`, such as the Control solve tree or the live scene tree. The
 * caches change outside React, so the reader re-derives whenever this number moves.
 */

import { useEffect, useMemo, useSyncExternalStore, type RefObject } from 'react';
import type { ResourceLoader } from './ResourceLoader';
import type { ResourceChange, ResourceType } from './ResourceEventBus';
import { subscribeToNothing } from '../utils/subscribeToNothing';

interface VersionStore {
  subscribe: (onChange: () => void) => () => void;
  get: () => number;
  /**
   * Hears the changes after the token `since`, which the render showing `renderedVersion` took.
   * A change in the gap between that render and the commit woke no listener, or one that dropped
   * a key `readKeys` took in only at the commit.
   */
  catchUp: (since: number, renderedVersion: number) => void;
}

/**
 * Written only by `nextVersion`. Every version of every store comes from it, so a store rebuilt
 * for new inputs starts above the last one and never repeats a number a reader has seen.
 */
let versionClock = 0;

function nextVersion(): number {
  return ++versionClock;
}

/**
 * The version of one reader. `version` and `listeners` are written only by `subscribe`, its
 * listener and `catchUp`. A store built in a render that React discards is never subscribed, so it
 * leaves nothing behind.
 */
function createVersionStore(
  loader: ResourceLoader | null | undefined,
  busTypes: readonly ResourceType[],
  readKeys: RefObject<ReadonlySet<string>> | undefined,
  onlyReadKeys: boolean
): VersionStore {
  let version = nextVersion();
  if (!loader) return { subscribe: subscribeToNothing, get: () => version, catchUp: () => {} };

  const listeners = new Set<() => void>();
  /** True when the change asks the reader to read again: an invalidated key read is requested instead. */
  const moves = ({ busType, event, key }: ResourceChange): boolean => {
    const isRead = readKeys?.current.has(key) ?? false;
    if (event !== 'invalidated') return isRead || !onlyReadKeys;
    if (isRead) loader.processor(busType)?.request(key);
    return false;
  };
  const move = () => {
    version = nextVersion();
    for (const listener of listeners) listener();
  };

  return {
    get: () => version,
    subscribe(onChange) {
      listeners.add(onChange);
      const unsubscribe = loader.eventBus.onChange(busTypes, (change) => {
        if (moves(change)) move();
      });
      return () => {
        unsubscribe();
        listeners.delete(onChange);
      };
    },
    catchUp(since, renderedVersion) {
      const missed = loader.eventBus.changesSince(busTypes, since).filter(moves);
      // A version that moved after the render already has a render on the way, which reads anew.
      if (missed.length > 0 && version === renderedVersion) move();
    },
  };
}

/**
 * Moves on a `loaded` or `failed` on `busTypes`, never on `invalidated`, so the old render
 * stays up while a key reloads. An invalidated key in `readKeys`, the keys the last derive
 * read, is requested again. It does not wait for every such key: one that never settles
 * would freeze the reader. With `onlyReadKeys`, a `loaded` or `failed` on a key outside
 * `readKeys` moves nothing, so a reader of few files does not render for every file in the project.
 * A change between a render and its commit, which no listener heard for that render, moves it once
 * after the commit, judged against `readKeys` as the commit's layout effects left it.
 * The number only grows, whatever inputs the reader changes.
 */
export function useCacheVersion(
  loader: ResourceLoader | null | undefined,
  busTypes: readonly ResourceType[],
  readKeys?: RefObject<ReadonlySet<string>>,
  { onlyReadKeys = false } = {}
): number {
  const store = useMemo(
    () => createVersionStore(loader, busTypes, readKeys, onlyReadKeys),
    [loader, busTypes, readKeys, onlyReadKeys]
  );
  const version = useSyncExternalStore(store.subscribe, store.get, store.get);
  const renderedAt = loader?.eventBus.changeToken() ?? 0;
  // A passive effect, after every layout effect of the commit: a caller fills `readKeys` in one.
  useEffect(() => store.catchUp(renderedAt, version), [store, renderedAt, version]);
  return version;
}
