/**
 * One rasterised texture per scene and sub-resource, shared, bounded and
 * disposed. Many nodes share one gradient, and each raster costs
 * `width x height x 4` bytes and an upload. The cache owns the lifetime through
 * an `LRUCache`: consumers borrow and never dispose.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../parser/types.js';
import { LRUCache } from '../LRUCache.js';

/**
 * Distinct procedural textures kept resident: generous for real scenes, which
 * declare a handful, and a bound for a pathological one. An eviction frees its buffer.
 */
const MAX_ENTRIES = 64;

const cache = new LRUCache<THREE.Texture>(MAX_ENTRIES, (_key, texture) => texture.dispose());

/**
 * Per-parse identity for a scene's internal resources, minted on first use. A
 * re-parse makes a new array and so new keys, and the old entries age out.
 */
const sceneTokens = new WeakMap<readonly TscnInternalResource[], string>();
let nextToken = 0;

function sceneToken(internalResources: readonly TscnInternalResource[]): string {
  let token = sceneTokens.get(internalResources);
  if (token === undefined) {
    token = String(nextToken++);
    sceneTokens.set(internalResources, token);
  }
  return token;
}

/**
 * The shared texture for `subResourceId` in this scene, rasterised on first
 * request. Null, uncached, when `rasterize` declines. The texture is borrowed:
 * the cache disposes it, callers never do.
 */
export function proceduralTexture(
  internalResources: readonly TscnInternalResource[],
  subResourceId: string,
  rasterize: () => THREE.Texture | null
): THREE.Texture | null {
  const key = proceduralTextureKey(internalResources, subResourceId);
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
export function proceduralTextureKey(
  internalResources: readonly TscnInternalResource[],
  subResourceId: string
): string {
  return `${sceneToken(internalResources)}:${subResourceId}`;
}

/** Hold `key` resident for as long as a consumer is mounted. */
export function pinProceduralTexture(key: string): void {
  cache.pin(key);
}

/** Release a pin taken by `pinProceduralTexture`. */
export function unpinProceduralTexture(key: string): void {
  cache.unpin(key);
}

/** Test seam: drop every entry, disposing each. */
export function clearProceduralTextureCache(): void {
  cache.clear();
}
