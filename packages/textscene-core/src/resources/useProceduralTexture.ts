/**
 * The React side of `proceduralTextureCache`: a mounted component borrows a shared procedural
 * texture by pinning it. Resolving and pinning are one operation, since an overflowing cache
 * disposes an unpinned entry and the consumer, whose memo deps never changed, samples a dead texture.
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnInternalResource } from '../parser/types.js';
import { resolveProceduralTexture } from './textures/resolveProceduralTexture.js';
import {
  pinProceduralTexture,
  unpinProceduralTexture,
} from './textures/proceduralTextureCache.js';

/**
 * The procedural texture a `SubResource` ref names, held resident while the caller is mounted.
 * Null for every other form, which the caller's async path handles. `resolveProceduralTexture`
 * decides which types count. A Texture2D slot reads through here or `useTexture2D`, since a
 * path resolver finds no path for a procedural texture.
 */
export function useProceduralTexture(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): THREE.Texture | null {
  const resolved = useMemo(
    () => resolveProceduralTexture(ref, internalResources),
    [ref, internalResources]
  );
  useProceduralTexturePins(resolved ? [resolved.key] : []);
  return resolved?.texture ?? null;
}

/**
 * Holds every key resident while the caller is mounted, for a consumer with several procedural
 * slots. Keyed on the joined keys, not the array: an unpin and pin per render would flush the
 * disposals a pinned replace deferred. A key is `token:subResourceId`, so it holds no newline.
 */
export function useProceduralTexturePins(keys: readonly string[]): void {
  const pinnedKeys = keys.join('\n');
  useEffect(() => {
    if (!pinnedKeys) return undefined;
    const held = pinnedKeys.split('\n');
    held.forEach(pinProceduralTexture);
    return () => held.forEach(unpinProceduralTexture);
  }, [pinnedKeys]);
}
