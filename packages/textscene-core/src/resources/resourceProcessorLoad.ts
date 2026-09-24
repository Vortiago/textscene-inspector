/**
 * The processor's load lane: the cache/inflight/event transitions a load makes,
 * and the FileEventBus arrival handlers that drive them. `createResourceProcessor.ts`
 * owns the cache, the inflight map and the public surface, and passes both by reference.
 */

import type { FileEventBus, FileData } from './FileEventBus';
import type { ResourceEventBus, ResourceType } from './ResourceEventBus';
import type { LRUCache } from './LRUCache';
import { resourceFilePath } from './subResourcePath';
import * as logger from '../logger';

export interface LoadLaneContext<T> {
  cache: LRUCache<T | null>;
  /**
   * Per-path flight identity, owned by the factory. See its declaration there
   * for why a completion whose token has gone is dropped.
   */
  inflight: Map<string, symbol>;
  eventBus: ResourceEventBus;
  resourceType: ResourceType;
  fileEventBus?: FileEventBus;
  shouldProcess?: (path: string, data: FileData) => boolean;
  process?: (path: string, data: FileData) => Promise<T>;
  dispose?: (resource: T) => void;
}

export interface LoadLane<T> {
  /**
   * Shared finish-lane used by both the FileEventBus arrival handler and
   * the direct-load path. Centralising it keeps cache/inflight/event
   * transitions consistent across the two fetch modes.
   */
  finishLoad(path: string, work: () => Promise<T>): Promise<void>;
  /** The permanent-failure protocol: no retry, and every subscriber told. */
  fail(path: string, error: Error): void;
  handleFileLoaded(filePath: string, data: FileData): Promise<void>;
  handleFileFailed(filePath: string, error: Error): void;
}

export function createLoadLane<T>(ctx: LoadLaneContext<T>): LoadLane<T> {
  const { cache, inflight, eventBus, resourceType, fileEventBus, shouldProcess, process, dispose } =
    ctx;

  /**
   * Every in-flight resource one file's bytes can settle: the file itself plus
   * any **Sub-resource path** addressed inside it. Snapshotted before use
   * because `finishLoad` mutates `inflight`.
   */
  const awaitingFile = (filePath: string): string[] =>
    [...inflight.keys()].filter((key) => resourceFilePath(key) === filePath);

  const finishLoad = async (path: string, work: () => Promise<T>): Promise<void> => {
    const startTime = performance.now();
    const flight = inflight.get(path);
    eventBus.emit(resourceType, 'loading', path);

    try {
      const result = await work();
      if (inflight.get(path) !== flight) {
        // Cleared-era completion: dispose and drop. Caching or announcing it
        // would resurrect what the clear removed. See `inflight`.
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
      // The bytes are now materialised or cached as a `null` failure, so the byte
      // bus's copy would hold a large GLB twice (a no-op in `loadDirectly` mode).
      // Only once no other address awaits the file: `clearCache` drops its in-flight
      // token too, which would strand a sibling **Sub-resource path** in `pending`.
      const file = resourceFilePath(path);
      if (awaitingFile(file).length === 0) fileEventBus?.clearCache(file);
    }
  };

  const fail = (path: string, error: Error): void => {
    inflight.delete(path);
    cache.set(path, null); // Cache failure to prevent retries
    eventBus.emit<Error>(resourceType, 'failed', path, error);
  };

  // Bound handler for FileEventBus events (stored once to allow proper unsubscription)
  const handleFileLoaded = async (filePath: string, data: FileData): Promise<void> => {
    // Only process if this processor handles this file's data. Asked about
    // the file, never a sub-resource path: the question is what these bytes are.
    if (shouldProcess && !shouldProcess(filePath, data)) return;

    // Concurrently: each address owns its flight token and cache slot, and a
    // material's `process` ends awaiting its textures, network I/O that serial
    // iteration would queue behind the previous surface's.
    await Promise.all(
      awaitingFile(filePath).map(async (path) => {
        if (cache.has(path)) {
          inflight.delete(path);
          return;
        }

        if (!process) {
          // File-event-bus mode requires a `process` function. Without it
          // the processor cannot materialise the resource. Treat as failure.
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

  return { finishLoad, fail, handleFileLoaded, handleFileFailed };
}
