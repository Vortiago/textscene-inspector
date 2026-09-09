/**
 * The processor's load lane: the cache/inflight/event transitions a load makes,
 * and the FileEventBus arrival handlers that drive them.
 *
 * Split out of `createResourceProcessor.ts`, which still owns the cache, the
 * inflight map and the public surface — this takes both by reference, so the
 * two halves see exactly the same state the single closure did.
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

  return { finishLoad, fail, handleFileLoaded, handleFileFailed };
}
