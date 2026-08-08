/**
 * What a clear means to a processor: which entries go, which flights are
 * disowned, and who is told.
 *
 * Split out of `createResourceProcessor.ts`, which still owns the cache and the
 * inflight map — this takes both by reference, so a clear sees exactly the
 * state the single closure did.
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
 * Clear cache for a specific path, or all of it.
 *
 * Disposal is the cache's job: `delete`/`clear` route the removed value
 * through the same pin-aware path as capacity eviction, so a value a
 * mounted consumer still holds is deferred (not disposed out from under
 * it) until its last unpin. The `onEvict` hook the factory wires skips `null`
 * failure sentinels.
 */
export function createClearCache<T>(ctx: ClearContext<T>): (path?: string) => void {
  const { cache, inflight, eventBus, resourceType } = ctx;

  return (path?: string): void => {
    if (path) {
      // Per-path clear (hot-reload) stays silent: its caller re-requests
      // the path itself, and the resulting loaded/failed event heals
      // subscribed consumers.
      cache.delete(path);
      inflight.delete(path);
      // A **Sub-resource path** into the cleared file went stale with it, and
      // no caller re-requests one — `provideFile` knows only the file. So
      // these are announced instead: `useResource` answers `invalidated` by
      // re-requesting, which is the same healing path by a different door.
      // The file itself was already dropped above, so only its addresses
      // remain to match. The Set dedupes a key held in both maps, which would
      // otherwise be announced twice.
      for (const key of new Set([...cache.keys(), ...inflight.keys()])) {
        if (resourceFilePath(key) !== path) continue;
        cache.delete(key);
        inflight.delete(key);
        eventBus.emit(resourceType, 'invalidated', key);
      }
      logger.info(`[${resourceType}Processor] Cleared cache for: ${path}`);
    } else {
      // Silent by design: announcing dropped paths is the LOADER's job
      // (ResourceLoader.clearCaches emits `invalidated` after every layer
      // is reset) — emitting here would let re-entrant re-requests observe
      // a half-cleared composition. Dropping the flight tokens invalidates
      // cleared-era in-flight completions.
      cache.clear();
      inflight.clear();
      logger.info(`[${resourceType}Processor] Cleared all cache`);
    }
  };
}
