/**
 * Serves a ready value from a real `ResourceLoader`, as if it had loaded: the cache
 * holds it at once, and a request emits `loaded`. Test-only, like the rest of
 * `testing/`, and it never imports `vitest`.
 */
import type * as THREE from 'three';
import type { ParsedResource } from '../../parser/parsedResource';
import type { ArrayMeshResource } from '../processors/createArrayMeshProcessor';
import type { ResourceLoader } from '../ResourceLoader';
import type { ResourceProcessor } from '../resourceProcessorTypes';

/** The resource types a test preloads, each with the value its processor caches. */
interface Preloadable {
  texture: THREE.Texture;
  arraymesh: ArrayMeshResource;
  resource: ParsedResource;
}

/** Written only by `preloadResource`. One map per processor, so each is patched once. */
const preloadedByProcessor = new WeakMap<ResourceProcessor<unknown>, Map<string, unknown>>();

export function preloadResource<K extends keyof Preloadable>(
  loader: ResourceLoader,
  type: K,
  path: string,
  value: Preloadable[K]
): void {
  const processor = processorFor(loader, type) as ResourceProcessor<unknown>;
  let preloaded = preloadedByProcessor.get(processor);
  if (!preloaded) {
    preloaded = new Map();
    preloadedByProcessor.set(processor, preloaded);
    serveFirst(loader, type, processor, preloaded);
  }
  preloaded.set(path, value);
}

function processorFor<K extends keyof Preloadable>(loader: ResourceLoader, type: K) {
  if (type === 'texture') return loader.textures;
  if (type === 'arraymesh') return loader.arrayMeshes;
  return loader.resources;
}

/** Answers a preloaded path from `preloaded` and every other path from the processor. */
function serveFirst(
  loader: ResourceLoader,
  type: keyof Preloadable,
  processor: ResourceProcessor<unknown>,
  preloaded: ReadonlyMap<string, unknown>
): void {
  const getCached = processor.getCached.bind(processor);
  const request = processor.request.bind(processor);
  processor.getCached = (path) => (preloaded.has(path) ? preloaded.get(path) : getCached(path));
  processor.request = (path) => {
    if (!preloaded.has(path)) return request(path);
    loader.eventBus.emit(type, 'loaded', path, preloaded.get(path));
  };
}
