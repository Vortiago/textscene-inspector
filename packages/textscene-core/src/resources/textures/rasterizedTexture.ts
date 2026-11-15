/**
 * The one decoded-value-to-cached-texture step every procedural texture that rasterises in render
 * runs. Each slice supplies its type name and rasteriser.
 */

import type * as THREE from 'three';
import { proceduralTexture, proceduralTextureKey } from './proceduralTextureCache';
import { unlessAllocationFails } from './pixelAllocation';

/**
 * A rasterised procedural texture and the cache key that keeps it resident. They
 * travel together: an unpinned texture is free for eviction to dispose.
 */
export interface ProceduralTextureResolution<T extends THREE.Texture = THREE.Texture> {
  texture: T;
  /** Pinned for as long as a consumer holds `texture`. */
  key: string;
}

/**
 * The texture of `typeName` that `owner`, a decoded value, describes, rasterised once per owner.
 * Null for pixels the tab cannot allocate: a GradientTexture2D at Godot's 16384² ceiling is 1 GiB
 * of RGBA8. The result is borrowed: never dispose it.
 */
export function rasterizedTexture<T extends THREE.Texture>(
  owner: object,
  typeName: string,
  rasterize: () => T | null
): ProceduralTextureResolution<T> | null {
  // The cache holds plain THREE.Texture, but one owner and type name have one rasteriser, so
  // whatever the cache holds under this key came out of this same rasterize.
  const texture = proceduralTexture(owner, typeName, () =>
    unlessAllocationFails(allocationLabel(typeName), rasterize)
  ) as T | null;
  return texture && { texture, key: proceduralTextureKey(owner, typeName) };
}

/** How an allocation failure names the texture it could not build. */
export function allocationLabel(typeName: string): string {
  return `[${typeName}]`;
}
