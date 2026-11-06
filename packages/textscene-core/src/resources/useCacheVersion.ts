/**
 * A version number for a reader that reads the loader's caches directly instead of
 * through `useResource`, such as the Control solve tree or the live scene tree. The
 * caches change outside React, so the reader re-derives whenever this number moves.
 */

import { useMemo, useSyncExternalStore, type RefObject } from 'react';
import type { ResourceLoader } from './ResourceLoader';
import type { ResourceType } from './ResourceEventBus';

interface VersionStore {
  subscribe: (onChange: () => void) => () => void;
  get: () => number;
}

const NO_UNSUBSCRIBE = () => {};

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
  let version = 0;
  const settleCount = () => loader?.eventBus.settleCount(busTypes) ?? 0;
  // The settles this reader has accounted for: it starts at the render that built the store.
  let accountedSettles = settleCount();

  return {
    get: () => version,
    subscribe(onChange) {
      if (!loader) return NO_UNSUBSCRIBE;
      // A settle between the render and this subscription woke no one: React reads the snapshot
      // again after subscribing, so moving it here renders the reader once more.
      if (settleCount() !== accountedSettles) {
        accountedSettles = settleCount();
        version += 1;
      }
      return loader.eventBus.onChange(busTypes, ({ busType, event, key }) => {
        const isRead = readKeys?.current.has(key) ?? false;
        if (event === 'invalidated') {
          if (isRead) loader.processor(busType)?.request(key);
          return;
        }
        accountedSettles = settleCount();
        if (isRead || !onlyReadKeys) {
          version += 1;
          onChange();
        }
      });
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
 * A caller keeps `busTypes` and `readKeys` stable: a new one starts the version again from zero.
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
