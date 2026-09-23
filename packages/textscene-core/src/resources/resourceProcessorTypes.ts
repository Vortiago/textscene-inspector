/**
 * The resource processor's contract: what a caller configures, what it gets
 * back, and the cache bound both sides assume. The two-mode overview lives in
 * `createResourceProcessor.ts`.
 */

import type { FileEventBus, FileData } from './FileEventBus';
import type { ResourceEventBus, ResourceType } from './ResourceEventBus';

/**
 * Default per-type cache bound, several times the external resources of the
 * largest vendored scene, so it holds any scene's working set. A resource a
 * mounted consumer holds is never capacity-evicted: see `pin`.
 */
export const DEFAULT_MAX_ENTRIES = 200;

export interface ResourceProcessorConfig<T> {
  fileEventBus?: FileEventBus;
  eventBus: ResourceEventBus;
  resourceType: ResourceType;
  /** Whether this processor handles the given path/data. */
  shouldProcess?: (path: string, data: FileData) => boolean;
  /** Raw data into the final resource (file-event-bus mode). */
  process?: (path: string, data: FileData) => Promise<T>;
  /**
   * Whether `process` reads a **Sub-resource path**'s `subResourceId` and builds
   * that resource rather than the owning file's `[resource]` body. Opt-in, and the
   * default refuses loudly: a `process` that ignores its path would cache the whole
   * file's resource under the address, a wrong resource under a right-looking name.
   */
  addressesSubResources?: boolean;
  /**
   * Direct-load mode: skip FileEventBus and fetch+materialise the
   * resource in one step. Mutually exclusive with `process` + `shouldProcess`.
   */
  loadDirectly?: (path: string) => Promise<T>;
  dispose?: (resource: T) => void;
  /**
   * Bound on the distinct paths this processor caches, `DEFAULT_MAX_ENTRIES` by
   * default. Past it the least-recently-used unpinned entry is evicted and
   * `dispose`d. With every entry pinned the cache grows past it, and shrinks on unpin.
   */
  maxEntries?: number;
}

export interface ResourceProcessor<T> {
  /** Non-blocking. */
  request(path: string): void;
  /** Null when the load failed. */
  getCached(path: string): T | null | undefined;
  isCached(path: string): boolean;
  isLoading(path: string): boolean;
  /** One path, or all of them when none is given. */
  clearCache(path?: string): void;
  /** For debugging. */
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
   * Increment the pin count for `path` on mount, paired with `unpin` on unmount.
   * `evictOverflow` skips a pinned entry. `clearCache` still removes it but defers
   * disposal to the last unpin, and the count survives, so the reload is pinned.
   */
  pin(path: string): void;
  /**
   * Decrement the pin count for `path`, clamped at zero. The entry stays until
   * the next overflow's LRU eviction, so a StrictMode unmount and remount keeps it.
   */
  unpin(path: string): void;
}
