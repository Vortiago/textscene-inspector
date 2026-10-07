/**
 * What a clear means to a processor: which entries go, which flights are
 * disowned, and who is told. `createResourceProcessor.ts` owns the cache and the
 * inflight map and passes both by reference.
 */

import type { ResourceEventBus, ResourceType } from './ResourceEventBus';
import { resourceFilePath } from './subResourcePath';
import * as logger from '../logger';

/**
 * The part of a cache a clear touches. Structural, so the test fake's plain `Map`
 * runs the same clear as the processor's `LRUCache`.
 */
export interface ClearableCache {
  keys(): IterableIterator<string>;
  delete(key: string): unknown;
  clear(): void;
}

export interface ClearContext {
  cache: ClearableCache;
  inflight: Map<string, symbol>;
  eventBus: ResourceEventBus;
  resourceType: ResourceType;
}

/**
 * Clear cache for a specific path, or all of it. The cache disposes: `delete`
 * and `clear` take the pin-aware eviction path, so a value a mounted consumer
 * holds waits for its last unpin. The factory's `onEvict` skips a cached failure.
 */
export function createClearCache(ctx: ClearContext): (path?: string) => void {
  const { cache, inflight, resourceType } = ctx;

  return (path?: string): void => {
    // `!== undefined`, not truthiness: `''` is a representable path (a
    // sub-resource address `'::id'` normalises to it), and the full clear below
    // would wipe every cached resource and abandon every load unannounced.
    if (path !== undefined) {
      clearPath(ctx, path);
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

/**
 * Drop `path` and every **Sub-resource path** in it, then announce each as `invalidated`.
 * `path` is announced even when not held: a reader with no pin may have lost its failure
 * to eviction. All keys go before the first emit, since a listener re-requests at once.
 */
function clearPath(ctx: ClearContext, path: string): void {
  const { cache, inflight, eventBus, resourceType } = ctx;
  const cleared = [...new Set([path, ...cache.keys(), ...inflight.keys()])].filter(
    (key) => key === path || resourceFilePath(key) === path
  );
  for (const key of cleared) {
    cache.delete(key);
    inflight.delete(key);
  }
  for (const key of cleared) eventBus.emit(resourceType, 'invalidated', key);
}
