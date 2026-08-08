/**
 * The resource processor's contract: what a caller configures, what it gets
 * back, and the cache bound both sides assume.
 *
 * Split out of `createResourceProcessor.ts` so the factory reads as the machine
 * it is; the two-mode overview lives there.
 */

import type { FileEventBus, FileData } from './FileEventBus';
import type { ResourceEventBus, ResourceType } from './ResourceEventBus';

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
export const DEFAULT_MAX_ENTRIES = 200;

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
