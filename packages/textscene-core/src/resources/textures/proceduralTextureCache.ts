/**
 * One rasterised texture per decoded resource, or per content for a
 * texture built off the main thread, shared, bounded and disposed. Many nodes share one gradient, and each raster costs
 * `width x height x 4` bytes and an upload. The cache owns the lifetime through
 * an `LRUCache`: consumers borrow and never dispose.
 */

import type * as THREE from 'three';
import { identityKey } from '../../utils/identityKey.js';
import { LRUCache } from '../LRUCache.js';

/**
 * Distinct procedural textures kept resident: generous for real scenes, which
 * declare a handful, and a bound for a pathological one. An eviction frees its buffer.
 */
const MAX_ENTRIES = 64;

const cache = new LRUCache<THREE.Texture>(MAX_ENTRIES, (_key, texture) => texture.dispose());

/**
 * The shared texture `id` names for `owner`, rasterised on first request. `owner` is the decoded
 * value the texture is built from, which keeps its identity while the resource holds. Null,
 * uncached, when `rasterize` declines. The texture is borrowed: the cache disposes it, callers never do.
 */
export function proceduralTexture(
  owner: object,
  id: string,
  rasterize: () => THREE.Texture | null
): THREE.Texture | null {
  const key = proceduralTextureKey(owner, id);
  const cached = cache.get(key);
  if (cached) return cached;

  const rasterized = rasterize();
  if (!rasterized) return null;
  cache.set(key, rasterized);
  return rasterized;
}

/**
 * The cache key a consumer must pin while it holds the texture. Without a pin,
 * the 65th gradient disposes the least-recently-used one while a mounted slot
 * still samples it, and nothing re-rasterises: its memo deps have not changed.
 */
export function proceduralTextureKey(owner: object, id: string): string {
  return `${identityKey(owner)}:${id}`;
}

/** The texture cached under `key`, for a build keyed on its content rather than its owner. */
export function cachedProceduralTexture(key: string): THREE.Texture | undefined {
  return cache.get(key);
}

/** Caches a texture built under a content key. The cache owns it from now on. */
export function cacheProceduralTexture(key: string, texture: THREE.Texture): void {
  cache.set(key, texture);
}

/** Frees each cached texture from every renderer, and keeps it cached: a renderer uploads it again. */
export function releaseProceduralTextures(): void {
  for (const texture of cache.values()) texture.dispose();
}

/** Hold `key` resident for as long as a consumer is mounted. */
export function pinProceduralTexture(key: string): void {
  cache.pin(key);
}

/** Release a pin taken by `pinProceduralTexture`. */
export function unpinProceduralTexture(key: string): void {
  cache.unpin(key);
}

/** Drops every entry, disposing each now or, while pinned, at its last unpin. */
export function clearProceduralTextures(): void {
  cache.clear();
}
