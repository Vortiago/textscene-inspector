/**
 * A version number for a reader that reads the loader's caches directly instead of
 * through `useResource`, such as the Control solve tree or the live scene tree. The
 * caches change outside React, so the reader re-derives whenever this number moves.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ResourceLoader } from './ResourceLoader';
import type { ResourceType } from './ResourceEventBus';

/**
 * Moves on a `loaded` or `failed` on `busTypes`, never on `invalidated`, so the old render
 * stays up while a key reloads. An invalidated key in `readKeys`, the keys the last derive
 * read, is requested again. It does not wait for every such key: one that never settles
 * would freeze the reader. With `onlyReadKeys`, a `loaded` or `failed` on a key outside
 * `readKeys` moves nothing, so a reader of few files does not render for every file in the project.
 * A load that settles between the render and the subscription, which commits later, moves it once
 * after subscribing: that settle woke no one, and its reader would wait for good.
 */
export function useCacheVersion(
  loader: ResourceLoader | null | undefined,
  busTypes: readonly ResourceType[],
  readKeys?: RefObject<ReadonlySet<string>>,
  { onlyReadKeys = false } = {}
): number {
  const [version, setVersion] = useState(0);
  const settledAtRender = useRef(0);
  settledAtRender.current = loader?.eventBus.settleCount ?? 0;

  useEffect(() => {
    if (!loader) return undefined;
    if (loader.eventBus.settleCount !== settledAtRender.current) setVersion((v) => v + 1);
    return loader.eventBus.onChange(busTypes, ({ busType, event, key }) => {
      const isRead = readKeys?.current.has(key) ?? false;
      if (event !== 'invalidated') {
        if (isRead || !onlyReadKeys) setVersion((v) => v + 1);
      } else if (isRead) loader.processor(busType)?.request(key);
    });
  }, [loader, busTypes, readKeys, onlyReadKeys]);

  return version;
}
