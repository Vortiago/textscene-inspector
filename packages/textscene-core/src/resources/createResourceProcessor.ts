/**
 * The generic resource processor: one cache, in-flight map and event emitter,
 * parameterised by how a resource is fetched and processed. The load transitions
 * live in `resourceProcessorLoad.ts` and the invalidation in `resourceProcessorClear.ts`.
 */

import type { ResourceType } from './ResourceEventBus';
import { LRUCache } from './LRUCache';
import { parseSubResourcePath, resourceFilePath } from './subResourcePath';
import { createLoadLane } from './resourceProcessorLoad';
import { createClearCache } from './resourceProcessorClear';
import { DEFAULT_MAX_ENTRIES } from './resourceProcessorTypes';
import type { ResourceProcessor, ResourceProcessorConfig } from './resourceProcessorTypes';
import * as logger from '../logger';

/**
 * Ceiling on waiting for a peer processor's address (a material's texture, a font's
 * `base_font`), far above any real fetch: a dependency that never arrives fails the
 * dependent instead of parking it. Shared so `ResourceLoader.peerLoad` and the font
 * processor's loader cannot drift apart.
 */
export const PEER_LOAD_TIMEOUT_MS = 30_000;

export type { ResourceType };
export type { ResourceProcessor, ResourceProcessorConfig } from './resourceProcessorTypes';

/**
 * Create a resource processor with caching, deduplication and event emission.
 * Configure exactly one fetch mode: `fileEventBus` with `shouldProcess` and
 * `process` (bytes, then process), or `loadDirectly` for a load that needs the
 * path and content together, such as a scene.
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

  // Capacity eviction disposes like `clearCache()`, but skips a `null` failure sentinel.
  const cache = new LRUCache<T | null>(config.maxEntries ?? DEFAULT_MAX_ENTRIES, (_path, value) => {
    if (value && dispose) dispose(value);
  });
  // A load owns its path's entry through a unique token. A clear removes the entry,
  // so a load that completes under the cleared provider state finds its token gone
  // and is disposed, never cached or announced. A later request loads fresh.
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

  if (fileEventBus) {
    fileEventBus.on('loaded', handleFileLoaded);
    fileEventBus.on('failed', handleFileFailed);
  }

  return {
    request(path: string): void {
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

      if (inflight.has(path)) {
        logger.info(`[${resourceType}Processor] Already loading: ${path}`);
        return;
      }

      const { filePath, subResourceId } = parseSubResourcePath(path);
      if (subResourceId !== undefined && !addressesSubResources) {
        // Refused before any fetch: reading a sub-resource is a property of `process`,
        // not of the bytes. Answering here also covers `loadDirectly` mode and cannot
        // leave the address stuck in flight, as a post-arrival check can.
        fail(
          path,
          new Error(
            `${resourceType} processor cannot address the sub-resource ` +
              `"${subResourceId}" inside ${filePath}`
          )
        );
        return;
      }

      inflight.set(path, Symbol(path));
      eventBus.emit(resourceType, 'requested', path);

      if (loadDirectly) {
        void finishLoad(path, () => loadDirectly(path));
      } else if (fileEventBus) {
        // The byte layer, and the provider, watcher and **Resource upload**s behind
        // it, only sees real files: a sub-resource's bytes are its owning file's.
        fileEventBus.request(resourceFilePath(path));
      } else {
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
