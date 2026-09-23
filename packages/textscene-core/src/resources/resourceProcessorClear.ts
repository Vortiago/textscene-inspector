/**
 * What a clear means to a processor: which entries go, which flights are
 * disowned, and who is told. `createResourceProcessor.ts` owns the cache and the
 * inflight map and passes both by reference.
 */

import type { ResourceEventBus, ResourceType } from './ResourceEventBus';
import type { LRUCache } from './LRUCache';
import { resourceFilePath } from './subResourcePath';
import * as logger from '../logger';

export interface ClearContext<T> {
  cache: LRUCache<T | null>;
  inflight: Map<string, symbol>;
  eventBus: ResourceEventBus;
  resourceType: ResourceType;
}

/**
 * Clear cache for a specific path, or all of it. The cache disposes: `delete`
 * and `clear` take the pin-aware eviction path, so a value a mounted consumer
 * holds waits for its last unpin. The factory's `onEvict` skips `null` sentinels.
 */
export function createClearCache<T>(ctx: ClearContext<T>): (path?: string) => void {
  const { cache, inflight, eventBus, resourceType } = ctx;

  return (path?: string): void => {
    // `!== undefined`, not truthiness: `''` is a representable path (a
    // sub-resource address `'::id'` normalises to it), and the full clear below
    // would wipe every cached resource and abandon every load unannounced.
    if (path !== undefined) {
      // Per-path clear (hot-reload) stays silent: its caller re-requests
      // the path itself, and the resulting loaded/failed event heals
      // subscribed consumers.
      cache.delete(path);
      inflight.delete(path);
      // A **Sub-resource path** into the cleared file is stale too, and
      // `provideFile` re-requests only the file, so each is announced:
      // `useResource` answers `invalidated` by re-requesting. The Set dedupes
      // a key held in both maps.
      for (const key of new Set([...cache.keys(), ...inflight.keys()])) {
        if (resourceFilePath(key) !== path) continue;
        cache.delete(key);
        inflight.delete(key);
        eventBus.emit(resourceType, 'invalidated', key);
      }
      logger.info(`[${resourceType}Processor] Cleared cache for: ${path}`);
    } else {
      // Silent: the loader announces dropped paths (ResourceLoader.clearCaches
      // emits `invalidated` after every layer resets), since emitting here lets
      // a re-entrant re-request see a half-cleared composition. Dropping the
      // flight tokens invalidates cleared-era completions.
      cache.clear();
      inflight.clear();
      logger.info(`[${resourceType}Processor] Cleared all cache`);
    }
  };
}
