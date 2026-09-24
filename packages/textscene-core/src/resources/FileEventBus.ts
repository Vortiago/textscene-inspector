/**
 * The byte layer: `request(path)` loads a file through the provider and emits
 * `loaded` or `failed`. It knows no resource type, and its consumers process the bytes.
 */

import type { ResourceProvider } from './ResourceProvider.js';
import * as logger from '../logger.js';

export type FileData = ArrayBuffer | string;
export type FileLoadedHandler = (path: string, data: FileData) => void;
export type FileFailedHandler = (path: string, error: Error) => void;

export class FileEventBus {
  private cache = new Map<string, FileData>();
  /**
   * A fetch owns its path's entry through a unique token. A clear removes the entry,
   * so a fetch that ran against the cleared provider state finds its token gone and
   * drops silently. A later request fetches fresh instead of deduping into it.
   */
  private inflight = new Map<string, symbol>();
  private loadedHandlers = new Set<FileLoadedHandler>();
  private failedHandlers = new Set<FileFailedHandler>();

  constructor(private provider: ResourceProvider) {}

  /** Load a file and emit `loaded` or `failed`. A request for a path in flight is dropped. */
  request(path: string): void {
    if (this.cache.has(path)) {
      logger.info(`[FileEventBus] Cache hit: ${path}`);
      const data = this.cache.get(path)!;
      // Asynchronous, so a cache hit emits in the same order as a fetch.
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

    if (this.inflight.has(path)) {
      logger.info(`[FileEventBus] Already loading: ${path}`);
      return;
    }

    logger.info(`[FileEventBus] Loading: ${path}`);
    this.loadAsync(path);
  }

  private async loadAsync(path: string): Promise<void> {
    const flight = Symbol(path);
    this.inflight.set(path, flight);
    const startTime = performance.now();

    try {
      const data = await this.provider.loadResource(path);

      if (this.inflight.get(path) !== flight) {
        // A cleared fetch touches no cache, handler or inflight entry, which a
        // later flight may own now.
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

      for (const handler of this.failedHandlers) {
        try {
          handler(path, err);
        } catch (handlerErr) {
          logger.error(`[FileEventBus] Handler error for failed:`, handlerErr);
        }
      }
    }
  }

  on(event: 'loaded', handler: FileLoadedHandler): void;
  on(event: 'failed', handler: FileFailedHandler): void;
  on(event: 'loaded' | 'failed', handler: FileLoadedHandler | FileFailedHandler): void {
    if (event === 'loaded') {
      this.loadedHandlers.add(handler as FileLoadedHandler);
    } else if (event === 'failed') {
      this.failedHandlers.add(handler as FileFailedHandler);
    }
  }

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
   * Read a file that may not exist, answering only the caller. An absent **Import
   * sidecar** means Godot's import defaults (ADR-0028), not a **Missing resource**.
   * It shares `request()`'s cache but fires no handler, which could re-enter a load.
   * `type` names the fetch in the host's miss log, not "Failed to fetch undefined".
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
   * Clear the byte cache and drop the flight tokens, so a follow-up request fetches fresh.
   * @param path - Specific file to clear, or all files if omitted
   */
  clearCache(path?: string): void {
    // `!== undefined`, not truthiness: `''` is a real key (a sub-resource address
    // with an empty file half), and reading it as "no path" clears every fetch.
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

  isCached(path: string): boolean {
    return this.cache.has(path);
  }

  isLoading(path: string): boolean {
    return this.inflight.has(path);
  }

  /** For debugging and tests. */
  getCacheSize(): number {
    return this.cache.size;
  }

  /** For debugging and tests. */
  getHandlerCounts(): { loaded: number; failed: number } {
    return {
      loaded: this.loadedHandlers.size,
      failed: this.failedHandlers.size,
    };
  }

  /** For cleanup and tests. */
  clearHandlers(): void {
    this.loadedHandlers.clear();
    this.failedHandlers.clear();
  }

  getProvider(): ResourceProvider {
    return this.provider;
  }
}
