/**
 * Factory function for creating resource processors.
 *
 * One generic cache + inflight + event-emission machine, parameterised
 * by *how* a resource is fetched and processed. The
 * PackedScene rides it too, through `createSceneProcessor`
 * (see `processors/createSceneProcessor.ts`), rather than reimplementing
 * the loop.
 *
 * Two fetch modes:
 *
 *   1. **Via FileEventBus** (textures, materials, GLB). `request(path)`
 *      delegates to `fileEventBus.request(path)`; when raw bytes arrive
 *      we run `shouldProcess` + `process` to materialise the resource.
 *
 *   2. **Direct** (scenes). `request(path)` invokes `loadDirectly(path)`
 *      itself — no FileEventBus involvement. Useful when the load step
 *      can't be decomposed into "fetch bytes then process" (e.g. the
 *      TSCN parser needs the path + content together).
 *
 * Configure exactly one of `fileEventBus` (paired with `shouldProcess`
 * + `process`) or `loadDirectly`. Mixing both is undefined behaviour.
 *
 * The config/result contract lives in `resourceProcessorTypes.ts`, the
 * load-side transitions in `resourceProcessorLoad.ts` and the invalidation
 * protocol in `resourceProcessorClear.ts`; this file owns the cache, the
 * inflight map and the public surface over them.
 */

import type { ResourceType } from './ResourceEventBus';
import { LRUCache } from './LRUCache';
import { parseSubResourcePath, resourceFilePath } from './subResourcePath';
import { createLoadLane } from './resourceProcessorLoad';
import { createClearCache } from './resourceProcessorClear';
import { DEFAULT_MAX_ENTRIES } from './resourceProcessorTypes';
import type { ResourceProcessor, ResourceProcessorConfig } from './resourceProcessorTypes';
import * as logger from '../logger';

export type { ResourceType };
export type { ResourceProcessor, ResourceProcessorConfig } from './resourceProcessorTypes';

/**
 * Create a resource processor with caching, deduplication, and event emission.
 *
 * The processor:
 * - Subscribes to FileEventBus for raw file loading
 * - Processes raw data into final resources
 * - Caches processed resources
 * - Emits typed events via ResourceEventBus
 * - Handles deduplication of parallel requests
 */
export function createResourceProcessor<T>(
  config: ResourceProcessorConfig<T>
): ResourceProcessor<T> {
  const {
    fileEventBus,
    eventBus,
    resourceType,
    shouldProcess,
    process,
    addressesSubResources = false,
    loadDirectly,
    dispose,
  } = config;

  // Bounded LRU: capacity eviction disposes the resource just like an
  // explicit clearCache() would, but skips `null` failure sentinels (no
  // real resource to dispose).
  const cache = new LRUCache<T | null>(config.maxEntries ?? DEFAULT_MAX_ENTRIES, (_path, value) => {
    if (value && dispose) dispose(value);
  });
  // Per-path flight identity. A load owns its path's entry via a unique
  // token; any clear (per-path hot-reload or full corpus switch) removes the
  // entry, so the load's completion — produced under the cleared era's
  // provider/content state — finds its token gone and is dropped (disposed,
  // never cached or announced). A post-clear request installs a NEW token
  // and loads fresh instead of racing the doomed flight.
  const inflight = new Map<string, symbol>();

  const { finishLoad, fail, handleFileLoaded, handleFileFailed } = createLoadLane<T>({
    cache,
    inflight,
    eventBus,
    resourceType,
    fileEventBus,
    shouldProcess,
    process,
    dispose,
  });

  const clearCache = createClearCache<T>({ cache, inflight, eventBus, resourceType });

  // Subscribe to FileEventBus (if provided)
  if (fileEventBus) {
    fileEventBus.on('loaded', handleFileLoaded);
    fileEventBus.on('failed', handleFileFailed);
  }

  return {
    request(path: string): void {
      // Check cache first
      if (cache.has(path)) {
        const cached = cache.get(path);
        if (cached !== null) {
          logger.info(`[${resourceType}Processor] Cache hit for: ${path}`);
          eventBus.emit<T>(resourceType, 'loaded', path, cached);
        } else {
          logger.info(`[${resourceType}Processor] Cache hit (failed) for: ${path}`);
          eventBus.emit<Error>(
            resourceType,
            'failed',
            path,
            new Error(`${resourceType} ${path} previously failed to load`)
          );
        }
        return;
      }

      // Deduplicate in-flight requests
      if (inflight.has(path)) {
        logger.info(`[${resourceType}Processor] Already loading: ${path}`);
        return;
      }

      const { filePath, subResourceId } = parseSubResourcePath(path);
      if (subResourceId !== undefined && !addressesSubResources) {
        // Refused before anything is fetched: whether this processor can read a
        // sub-resource is a property of its `process`, not of the bytes, so
        // there is nothing to learn by loading the file first. Answering here
        // also covers `loadDirectly` mode and cannot leave the address stuck
        // in-flight the way a post-arrival check can.
        fail(
          path,
          new Error(
            `${resourceType} processor cannot address the sub-resource ` +
              `"${subResourceId}" inside ${filePath}`
          )
        );
        return;
      }

      // Start loading
      inflight.set(path, Symbol(path));
      eventBus.emit(resourceType, 'requested', path);

      if (loadDirectly) {
        // Direct-load mode: no FileEventBus round-trip.
        void finishLoad(path, () => loadDirectly(path));
      } else if (fileEventBus) {
        // The byte layer (and, through it, the host `ResourceProvider`, the
        // hot-reload watcher and **Resource upload**s) only ever sees real
        // files; a sub-resource's bytes are its owning file's bytes.
        fileEventBus.request(resourceFilePath(path));
      } else {
        // Misconfigured — neither fetch mode available.
        inflight.delete(path);
        eventBus.emit<Error>(
          resourceType,
          'failed',
          path,
          new Error(`No fetch mode configured for ${resourceType}: ${path}`)
        );
      }
    },

    getCached(path: string): T | null | undefined {
      return cache.get(path);
    },

    isCached(path: string): boolean {
      return cache.has(path);
    },

    isLoading(path: string): boolean {
      return inflight.has(path);
    },

    clearCache,

    getCacheSize(): number {
      return cache.size;
    },

    cachedPaths(): string[] {
      return [...cache.keys()];
    },

    inflightPaths(): string[] {
      return [...inflight.keys()];
    },

    pin(path: string): void {
      cache.pin(path);
    },

    unpin(path: string): void {
      cache.unpin(path);
    },
  };
}
