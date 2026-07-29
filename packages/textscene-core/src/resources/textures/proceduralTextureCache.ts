/**
 * One rasterised texture per (scene, sub-resource) — shared, bounded, disposed.
 *
 * A procedural texture is described entirely inside the scene, so it never
 * reaches the loader's file-backed pipeline; but it has the same sharing
 * problem an image does. A scene points many nodes at ONE gradient — a
 * dungeon's torches all share a single radial cookie — and rasterising per
 * consumer costs `width x height x 4` bytes and a GPU upload every time.
 *
 * Sharing it is only safe if nobody else owns it, so this cache owns the
 * lifetime outright: consumers hold a borrowed reference and never dispose,
 * exactly as they treat a loader-supplied texture. The same `LRUCache` the
 * resource processors use gives that for free — a bound on how much stays
 * resident, and `dispose()` on the pixel buffer when an entry is evicted.
 *
 * Invalidation rides scene identity. The key includes a token minted per
 * `internalResources` array, so re-parsing a scene yields a new array, new
 * token, and new entries; the superseded ones age out of the LRU and are
 * disposed on the way. Nothing has to notice the reload.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../parser/types.js';
import { LRUCache } from '../LRUCache.js';

/**
 * Distinct procedural textures kept resident. Generous next to real scenes —
 * the vendored corpus's heaviest user declares a handful — while still bounding
 * a pathological scene, and every eviction frees its buffer.
 */
const MAX_ENTRIES = 64;

const cache = new LRUCache<THREE.Texture>(MAX_ENTRIES, (_key, texture) => texture.dispose());

/** Per-parse identity for a scene's internal resources, minted on first use. */
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
 * The shared texture for `subResourceId` in this scene, rasterising it through
 * `rasterize` on first request. Returns null when `rasterize` declines (the
 * reference names something else), and does not cache that.
 *
 * The returned texture is BORROWED — the cache disposes it, callers never do.
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
 * The cache key a consumer must pin while it holds the texture.
 *
 * Sharing is only safe because the cache owns the lifetime, and it can only own
 * it if it knows who is still borrowing. Without a pin, the 65th distinct
 * gradient in one canvas evicts and DISPOSES the least-recently-used one while
 * a mounted cookie or albedo slot is still sampling it — nothing re-rasterises,
 * because the consumer's memo deps have not changed.
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
