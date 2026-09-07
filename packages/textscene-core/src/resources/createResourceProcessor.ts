/**
 * Factory function for creating resource processors.
 *
 * One generic cache + inflight + event-emission machine, parameterised
 * by *how* a resource is fetched and processed. The
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
import { parseSubResourcePath, resourceFilePath } from './subResourcePath';
import * as logger from '../logger';

/**
 * Ceiling on waiting for a PEER processor to publish an address this one
 * depends on — a material's texture, a font's `base_font`. Far above any real
 * fetch: it exists so a dependency that never arrives fails the dependent
 * instead of parking it forever, not to bound a slow load. Shared so the two
 * waiters (`ResourceLoader.peerLoad` and the font processor's own cycle-aware
 * loader) cannot drift to different ceilings.
 */
export const PEER_LOAD_TIMEOUT_MS = 30_000;

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
 * of how many other resources are loaded in the same session. Explicit
 * invalidation — `clearCache` / hot-reload — removes the entry too, but
 * disposal is pin-aware: an unpinned value is disposed immediately, while a
 * value a mounted consumer still holds is deferred until its last unpin (so
 * a hot-reload never hands a live mesh a dead material/texture/geometry).
 * The pin count survives the removal either way, so the re-loaded entry
 * comes back protected for the still-mounted consumer.
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
   * Whether `process` reads a **Sub-resource path**'s `subResourceId` and builds
   * THAT resource rather than the owning file's `[resource]` body.
   *
   * Normalising the address in this factory gives every processor the
   * fetch/cache/dedupe plumbing for free but NOT the semantics: a `process` that
   * ignores its path would return the whole file's resource and cache it under
   * the address — a wrong resource under a right-looking name, the exact trap
   * this grammar exists to avoid. So the capability is opt-in and the default
   * refuses, loudly. A processor whose author never heard of addresses is safe.
   */
  addressesSubResources?: boolean;
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
  /** Snapshot of the currently-cached paths (for the loader's full-clear announcement). */
  cachedPaths(): string[];
  /**
   * Snapshot of the paths currently loading. The loader's full-clear
   * announcement must cover these too: their completions are dropped as
   * cleared-era flights, so without an `invalidated` for them a mounted
   * consumer waiting on the load would hang in `pending` forever.
   */
  inflightPaths(): string[];
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

  /**
   * Shared finish-lane used by both the FileEventBus arrival handler and
   * the direct-load path. Centralising it keeps cache/inflight/event
   * transitions consistent across the two fetch modes.
   */
  const finishLoad = async (path: string, work: () => Promise<T>): Promise<void> => {
    const startTime = performance.now();
    const flight = inflight.get(path);
    eventBus.emit(resourceType, 'loading', path);

    try {
      const result = await work();
      if (inflight.get(path) !== flight) {
        // Cleared-era completion — dispose and drop; caching or announcing
        // it would resurrect what the clear removed. See `inflight`.
        if (result && dispose) dispose(result);
        logger.info(`[${resourceType}Processor] Dropped stale load: ${path}`);
        return;
      }
      cache.set(path, result);
      inflight.delete(path);
      const elapsed = performance.now() - startTime;
      logger.info(`[${resourceType}Processor] Loaded: ${path} (${elapsed.toFixed(2)}ms)`);
      eventBus.emit<T>(resourceType, 'loaded', path, result);
    } catch (error) {
      if (inflight.get(path) !== flight) {
        logger.info(`[${resourceType}Processor] Dropped stale failure: ${path}`);
        return;
      }
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
      //
      // But ONLY once nothing else still wants that file. `clearCache` drops the
      // byte bus's in-flight token too, and a fetch whose token has gone is
      // abandoned silently — neither `loaded` nor `failed`. Several
      // **Sub-resource path**s of one file are separate resources that each
      // request it, so clearing on the first one to finish would strand a
      // sibling in `pending` for good.
      const file = resourceFilePath(path);
      if (awaitingFile(file).length === 0) fileEventBus?.clearCache(file);
    }
  };

  /**
   * Every in-flight resource one file's bytes can settle: the file itself plus
   * any **Sub-resource path** addressed inside it. Snapshotted before use
   * because `finishLoad` mutates `inflight`.
   */
  const awaitingFile = (filePath: string): string[] =>
    [...inflight.keys()].filter((key) => resourceFilePath(key) === filePath);

  /** The permanent-failure protocol: no retry, and every subscriber told. */
  const fail = (path: string, error: Error): void => {
    inflight.delete(path);
    cache.set(path, null); // Cache failure to prevent retries
    eventBus.emit<Error>(resourceType, 'failed', path, error);
  };

  // Bound handler for FileEventBus events (stored once to allow proper unsubscription)
  const handleFileLoaded = async (filePath: string, data: FileData): Promise<void> => {
    // Only process if this processor should handle this file's data. Asked
    // about the FILE, never a sub-resource path — the question is what these
    // bytes are, which is exactly what an extension check can answer.
    if (shouldProcess && !shouldProcess(filePath, data)) return;

    // Concurrently, not in sequence: each address owns its own flight token and
    // cache slot, so their transitions are independent — while `process` for a
    // material ends in awaiting its textures, which is real network I/O. Serial
    // iteration made surface 2's textures wait for surface 1's to land.
    await Promise.all(
      awaitingFile(filePath).map(async (path) => {
        // Already cached - skip
        if (cache.has(path)) {
          inflight.delete(path);
          return;
        }

        if (!process) {
          // File-event-bus mode requires a `process` function; without it
          // the processor can't materialise the resource. Treat as failure.
          fail(path, new Error(`${resourceType} processor missing process() handler`));
          return;
        }

        await finishLoad(path, () => process(path, data));
      })
    );
  };

  const handleFileFailed = (filePath: string, error: Error): void => {
    for (const path of awaitingFile(filePath)) fail(path, error);
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

    clearCache(path?: string): void {
      // Disposal is the cache's job: `delete`/`clear` route the removed value
      // through the same pin-aware path as capacity eviction, so a value a
      // mounted consumer still holds is deferred (not disposed out from under
      // it) until its last unpin. The `onEvict` hook wired above skips `null`
      // failure sentinels.
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
    },

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
