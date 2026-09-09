/**
 * KISS file event bus for loading files.
 * No type coupling - just loads files, consumers process them.
 */

import type { ResourceProvider } from './ResourceProvider.js';
import * as logger from '../logger.js';

export type FileData = ArrayBuffer | string;
export type FileLoadedHandler = (path: string, data: FileData) => void;
export type FileFailedHandler = (path: string, error: Error) => void;

/**
 * Simple event bus for file loading.
 * request(path) → loaded/failed events
 */
export class FileEventBus {
  private cache = new Map<string, FileData>();
  /**
   * Per-path flight identity. A fetch owns its path's entry via a unique
   * token; any clear (full OR per-path) removes the entry, so the fetch's
   * completion — which ran against the provider/URL-modifier state of the
   * cleared era — finds its token gone and drops silently, never caching or
   * announcing. A post-clear request installs a NEW token and fetches fresh
   * instead of deduping into the doomed flight.
   */
  private inflight = new Map<string, symbol>();
  private loadedHandlers = new Set<FileLoadedHandler>();
  private failedHandlers = new Set<FileFailedHandler>();

  constructor(private provider: ResourceProvider) {}

  /**
   * Request a file to be loaded.
   * Emits 'loaded' or 'failed' event when complete.
   * Deduplicates in-flight requests.
   */
  request(path: string): void {
    // Check cache first
    if (this.cache.has(path)) {
      logger.info(`[FileEventBus] Cache hit: ${path}`);
      const data = this.cache.get(path)!;
      // Emit asynchronously to maintain consistent event ordering
      queueMicrotask(() => {
        for (const handler of this.loadedHandlers) {
          try {
            handler(path, data);
          } catch (err) {
            logger.error(`[FileEventBus] Handler error for loaded:`, err);
          }
        }
      });
      return;
    }

    // Deduplicate in-flight requests
    if (this.inflight.has(path)) {
      logger.info(`[FileEventBus] Already loading: ${path}`);
      return;
    }

    // Start loading
    logger.info(`[FileEventBus] Loading: ${path}`);
    this.loadAsync(path);
  }

  private async loadAsync(path: string): Promise<void> {
    const flight = Symbol(path);
    this.inflight.set(path, flight);
    const startTime = performance.now();

    try {
      // ResourceProvider.loadResource returns string | ArrayBuffer | null
      const data = await this.provider.loadResource(path);

      if (this.inflight.get(path) !== flight) {
        // Cleared-era completion — drop without touching cache, inflight
        // (a post-clear flight may own it now), or handlers. See `inflight`.
        logger.info(`[FileEventBus] Dropped stale load: ${path}`);
        return;
      }

      if (data === null) {
        throw new Error(`File not found: ${path}`);
      }

      this.cache.set(path, data);
      this.inflight.delete(path);

      const elapsed = performance.now() - startTime;
      logger.info(`[FileEventBus] ✅ Loaded: ${path} (${elapsed.toFixed(2)}ms)`);

      // Emit loaded event
      for (const handler of this.loadedHandlers) {
        try {
          handler(path, data);
        } catch (err) {
          logger.error(`[FileEventBus] Handler error for loaded:`, err);
        }
      }
    } catch (error) {
      if (this.inflight.get(path) !== flight) {
        logger.info(`[FileEventBus] Dropped stale failure: ${path}`);
        return;
      }
      this.inflight.delete(path);

      const elapsed = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(`[FileEventBus] ❌ Failed: ${path} (${elapsed.toFixed(2)}ms) - ${err.message}`);

      // Emit failed event
      for (const handler of this.failedHandlers) {
        try {
          handler(path, err);
        } catch (handlerErr) {
          logger.error(`[FileEventBus] Handler error for failed:`, handlerErr);
        }
      }
    }
  }

  /**
   * Subscribe to file events.
   */
  on(event: 'loaded', handler: FileLoadedHandler): void;
  on(event: 'failed', handler: FileFailedHandler): void;
  on(event: 'loaded' | 'failed', handler: FileLoadedHandler | FileFailedHandler): void {
    if (event === 'loaded') {
      this.loadedHandlers.add(handler as FileLoadedHandler);
    } else if (event === 'failed') {
      this.failedHandlers.add(handler as FileFailedHandler);
    }
  }

  /**
   * Unsubscribe from file events.
   */
  off(event: 'loaded', handler: FileLoadedHandler): void;
  off(event: 'failed', handler: FileFailedHandler): void;
  off(event: 'loaded' | 'failed', handler: FileLoadedHandler | FileFailedHandler): void {
    if (event === 'loaded') {
      this.loadedHandlers.delete(handler as FileLoadedHandler);
    } else if (event === 'failed') {
      this.failedHandlers.delete(handler as FileFailedHandler);
    }
  }

  /**
   * Read a file that is allowed not to exist, answering the caller and nobody else.
   *
   * `request()` treats a miss as a fault: it warns and fires the `failed` handlers,
   * which is what turns a missing file into a user-visible **Missing resource**. That is
   * right for a path a scene declares, and wrong for one discovered by convention — an
   * **Import sidecar** (`scene.gltf` → `scene.gltf.import`) is absent for most assets,
   * and its absence just means "use Godot's import defaults" (ADR-0028).
   *
   * Shares the cache with `request()` so a path is fetched once however it is reached,
   * but deliberately fires neither handler set: no consumer subscribes to a sidecar, and
   * waking every handler for one risks a re-entrant load.
   *
   * `type` reaches the provider's own logging, which names what it was fetching. Passing
   * it is not cosmetic: hosts log the miss, and an unnamed one reads as
   * "Failed to fetch undefined" on every scene that has no such file — which is most of
   * them, since these paths are found by convention rather than declared.
   */
  async tryLoad(path: string, type = 'OptionalFile'): Promise<FileData | null> {
    const cached = this.cache.get(path);
    if (cached !== undefined) return cached;

    try {
      const data = await this.provider.loadResource(path, type);
      if (data === null) return null;
      this.cache.set(path, data);
      return data;
    } catch {
      // Absence and unreachability are the same answer to the caller: no sidecar.
      return null;
    }
  }

  /**
   * Clear file cache.
   * @param path - Specific file to clear, or all files if omitted
   */
  clearCache(path?: string): void {
    // Dropping the flight token invalidates any in-flight completion for the
    // cleared path(s) and lets a follow-up request start a FRESH fetch
    // instead of deduping into the doomed flight — the same rule for the
    // per-path (hot-reload/provideFile) and full (corpus switch) forms.
    // `!== undefined`, not truthiness: `''` is a real key here (a sub-resource
    // address with an empty file half), and treating it as "no path given"
    // clears the whole byte cache and strands every unrelated fetch.
    if (path !== undefined) {
      this.cache.delete(path);
      this.inflight.delete(path);
      logger.info(`[FileEventBus] Cleared cache: ${path}`);
    } else {
      this.cache.clear();
      this.inflight.clear();
      logger.info(`[FileEventBus] Cleared all cache`);
    }
  }

  /**
   * Check if a file is cached.
   */
  isCached(path: string): boolean {
    return this.cache.has(path);
  }

  /**
   * Check if a file is currently loading.
   */
  isLoading(path: string): boolean {
    return this.inflight.has(path);
  }

  /**
   * Get cache size (for debugging/testing).
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get handler counts (for debugging/testing).
   */
  getHandlerCounts(): { loaded: number; failed: number } {
    return {
      loaded: this.loadedHandlers.size,
      failed: this.failedHandlers.size,
    };
  }

  /**
   * Clear all handlers (for cleanup/testing).
   */
  clearHandlers(): void {
    this.loadedHandlers.clear();
    this.failedHandlers.clear();
  }

  /**
   * Get the resource provider (for consumers that need direct access).
   */
  getProvider(): ResourceProvider {
    return this.provider;
  }
}
