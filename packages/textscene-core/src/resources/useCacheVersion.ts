/**
 * A version number for a reader that reads the loader's caches directly instead of
 * through `useResource`, such as the Control solve tree or the live scene tree. The
 * caches change outside React, so the reader re-derives whenever this number moves.
 */

import { useMemo, useSyncExternalStore, type RefObject } from 'react';
import type { ResourceLoader } from './ResourceLoader';
import type { ResourceType } from './ResourceEventBus';
import { subscribeToNothing } from '../utils/subscribeToNothing';

interface VersionStore {
  subscribe: (onChange: () => void) => () => void;
  get: () => number;
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
 * The version of one reader. `version` is written only by `subscribe` and its listener. A store
 * built in a render that React discards is never subscribed, so it leaves nothing behind.
 */
function createVersionStore(
  loader: ResourceLoader | null | undefined,
  busTypes: readonly ResourceType[],
  readKeys: RefObject<ReadonlySet<string>> | undefined,
  onlyReadKeys: boolean
): VersionStore {
  let version = nextVersion();
  if (!loader) return { subscribe: subscribeToNothing, get: () => version };

  const { eventBus } = loader;
  // The settles this reader has accounted for: it starts at the render that built the store, and
  // moves to the count at each unsubscribe, since no listener sees a settle after that.
  let accountedSettles = eventBus.settleCount(busTypes);

  return {
    get: () => version,
    subscribe(onChange) {
      // A settle between the render and this subscription woke no one: React reads the snapshot
      // again after subscribing, so moving it here renders the reader once more.
      if (eventBus.settleCount(busTypes) !== accountedSettles) version = nextVersion();
      const unsubscribe = eventBus.onChange(busTypes, ({ busType, event, key }) => {
        const isRead = readKeys?.current.has(key) ?? false;
        if (event === 'invalidated') {
          if (isRead) loader.processor(busType)?.request(key);
          return;
        }
        if (isRead || !onlyReadKeys) {
          version = nextVersion();
          onChange();
        }
      });
      return () => {
        unsubscribe();
        accountedSettles = eventBus.settleCount(busTypes);
      };
    },
  };
}

/**
 * Moves on a `loaded` or `failed` on `busTypes`, never on `invalidated`, so the old render
 * stays up while a key reloads. An invalidated key in `readKeys`, the keys the last derive
 * read, is requested again. It does not wait for every such key: one that never settles
 * would freeze the reader. With `onlyReadKeys`, a `loaded` or `failed` on a key outside
 * `readKeys` moves nothing, so a reader of few files does not render for every file in the project.
 * A load on `busTypes` that settles between the render and the subscription, which commits later,
 * moves it once after subscribing: that settle woke no one, and its reader would wait for good.
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
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
