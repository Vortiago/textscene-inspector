/**
 * Factory function for creating resource processors.
 *
 * One generic cache + inflight + event-emission machine, parameterised
 * by *how* a resource is fetched and processed. WI-ARCH-2: the
 * standalone `SceneLoader` class that previously reimplemented this
 * exact loop for PackedScene is now a `createSceneProcessor` factory
 * built on top of this one (see `processors/createSceneProcessor.ts`).
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
 */

import type { FileEventBus, FileData } from './FileEventBus';
import type { ResourceEventBus, ResourceType } from './ResourceEventBus';
import { LRUCache } from './LRUCache';
import * as logger from '../logger';

export type { ResourceType };

/**
 * Default per-type cache bound. Grounded against the corpus: the largest
 * vendored fixture (`scenes/demos/2d/role_playing_game/grid_movement/exploration.tscn`)
 * declares 28 external resources TOTAL across every resource type combined —
 * so 200 distinct entries in a single processor's cache is >7x any single
 * scene's entire working set.
 *
 * ## Eviction safety guarantee
 *
 * `useResource` increments a per-entry reference count (`LRUCache.pin`) on
 * mount and decrements it (`LRUCache.unpin`) on unmount. `evictOverflow`
 * skips entries with a nonzero count, falling back to pure LRU among the
 * zero-count (unmounted) entries. This is an absolute guarantee: a resource
 * held by at least one mounted consumer is never CAPACITY-evicted regardless
 * of how many other resources are loaded in the same session. (Explicit
 * invalidation — `clearCache` / hot-reload — still disposes and removes the
 * entry, but the pin count survives it, so the re-loaded entry comes back
 * protected for the still-mounted consumer.)
 *
 * When every cached entry is pinned and capacity is exceeded, the cache
 * temporarily grows beyond `maxEntries` rather than disposing a live
 * resource, and shrinks back as pins are released on unmount.
 *
 * React StrictMode double-invoke (mount -> unmount -> mount) is handled
 * correctly: the transient unmount decrements to zero but does not dispose
 * the entry, and the immediate remount increments back to 1.
 */
const DEFAULT_MAX_ENTRIES = 200;

export interface ResourceProcessorConfig<T> {
  fileEventBus?: FileEventBus;
  eventBus: ResourceEventBus;
  resourceType: ResourceType;
  /** Determine if this processor should handle the given path/data */
  shouldProcess?: (path: string, data: FileData) => boolean;
  /** Process raw data into final resource (file-event-bus mode) */
  process?: (path: string, data: FileData) => Promise<T>;
  /**
   * Direct-load mode: skip FileEventBus and fetch+materialise the
   * resource in one step. Mutually exclusive with `process` + `shouldProcess`.
   */
  loadDirectly?: (path: string) => Promise<T>;
  /** Optional cleanup when resource is removed from cache */
  dispose?: (resource: T) => void;
  /**
   * Bound on the number of distinct paths this processor caches.
   * Least-recently-used entries are evicted (and `dispose`d) once
   * exceeded. Defaults to `DEFAULT_MAX_ENTRIES`; override in tests that
   * want to observe eviction without inserting 200 entries.
   */
  maxEntries?: number;
}

export interface ResourceProcessor<T> {
  /** Request a resource to be loaded (non-blocking) */
  request(path: string): void;
  /** Get cached resource (may be null if load failed) */
  getCached(path: string): T | null | undefined;
  /** Check if resource is cached */
  isCached(path: string): boolean;
  /** Check if resource is currently loading */
  isLoading(path: string): boolean;
  /** Clear cache for specific path or all */
  clearCache(path?: string): void;
  /** Get cache size for debugging */
  getCacheSize(): number;
  /**
   * Increment the pin count for `path`. While count > 0, eviction will
   * skip this entry, preferring zero-count (unmounted) entries as eviction
   * candidates. Call on mount; pair with `unpin` on unmount.
   */
  pin(path: string): void;
  /**
   * Decrement the pin count for `path`, clamped at zero. Does not
   * immediately dispose or remove the entry — it becomes eligible for
   * ordinary LRU eviction on the next cache overflow.
   */
  unpin(path: string): void;
}

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
  const { fileEventBus, eventBus, resourceType, shouldProcess, process, loadDirectly, dispose } = config;

  // Bounded LRU: capacity eviction disposes the resource just like an
  // explicit clearCache() would, but skips `null` failure sentinels (no
  // real resource to dispose).
  const cache = new LRUCache<T | null>(config.maxEntries ?? DEFAULT_MAX_ENTRIES, (_path, value) => {
    if (value && dispose) dispose(value);
  });
  const inflight = new Set<string>();

  /**
   * Shared finish-lane used by both the FileEventBus arrival handler and
   * the direct-load path. Centralising it keeps cache/inflight/event
   * transitions consistent across the two fetch modes.
   */
  const finishLoad = async (path: string, work: () => Promise<T>): Promise<void> => {
    const startTime = performance.now();
    eventBus.emit(resourceType, 'loading', path);

    try {
      const result = await work();
      cache.set(path, result);
      inflight.delete(path);
      const elapsed = performance.now() - startTime;
      logger.info(`[${resourceType}Processor] Loaded: ${path} (${elapsed.toFixed(2)}ms)`);
      eventBus.emit<T>(resourceType, 'loaded', path, result);
    } catch (error) {
      cache.set(path, null); // Cache failure to prevent retries
      inflight.delete(path);
      const elapsed = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[${resourceType}Processor] Failed: ${path} (${elapsed.toFixed(2)}ms)`, err);
      eventBus.emit<Error>(resourceType, 'failed', path, err);
    } finally {
      // Raw bytes have now been materialised into `result` (or the attempt
      // failed and is cached as a permanent `null` sentinel) — FileEventBus's
      // copy is redundant from here on. Dropping it now prevents a large GLB
      // (etc.) from being retained twice: once as raw bytes, once as the
      // decoded resource. `loadDirectly` mode has no `fileEventBus` (scenes
      // fetch text directly), so this is a no-op there.
      fileEventBus?.clearCache(path);
    }
  };

  // Bound handler for FileEventBus events (stored once to allow proper unsubscription)
  const handleFileLoaded = async (path: string, data: FileData): Promise<void> => {
    // Only process if this processor should handle this path/data
    if (shouldProcess && !shouldProcess(path, data)) return;

    // Only process if we're waiting for this path
    if (!inflight.has(path)) return;

    // Already cached - skip
    if (cache.has(path)) {
      inflight.delete(path);
      return;
    }

    if (!process) {
      // File-event-bus mode requires a `process` function; without it
      // the processor can't materialise the resource. Treat as failure.
      inflight.delete(path);
      cache.set(path, null);
      eventBus.emit<Error>(
        resourceType,
        'failed',
        path,
        new Error(`${resourceType} processor missing process() handler`)
      );
      return;
    }

    await finishLoad(path, () => process(path, data));
  };

  const handleFileFailed = (path: string, error: Error): void => {
    if (!inflight.has(path)) return;

    inflight.delete(path);
    cache.set(path, null);
    eventBus.emit<Error>(resourceType, 'failed', path, error);
  };

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

      // Start loading
      inflight.add(path);
      eventBus.emit(resourceType, 'requested', path);

      if (loadDirectly) {
        // Direct-load mode: no FileEventBus round-trip.
        void finishLoad(path, () => loadDirectly(path));
      } else if (fileEventBus) {
        fileEventBus.request(path);
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

    clearCache(path?: string): void {
      if (path) {
        const cached = cache.get(path);
        if (cached && dispose) {
          dispose(cached);
        }
        cache.delete(path);
        inflight.delete(path);
        logger.info(`[${resourceType}Processor] Cleared cache for: ${path}`);
      } else {
        // Clear all
        if (dispose) {
          for (const resource of cache.values()) {
            if (resource) dispose(resource);
          }
        }
        cache.clear();
        inflight.clear();
        logger.info(`[${resourceType}Processor] Cleared all cache`);
      }
    },

    getCacheSize(): number {
      return cache.size;
    },

    pin(path: string): void {
      cache.pin(path);
    },

    unpin(path: string): void {
      cache.unpin(path);
    },
  };
}
