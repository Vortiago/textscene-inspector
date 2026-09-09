/**
 * Borrowing a procedural texture for as long as a component is mounted.
 *
 * A procedural texture is rasterised once and shared by every node pointing at
 * the same sub-resource, so `proceduralTextureCache` owns its lifetime and
 * consumers only borrow. The cache can honour a borrow only if it knows the
 * borrow exists: an unpinned entry is disposed outright once the cache
 * overflows, leaving the consumer sampling a dead texture with no reason to
 * re-rasterise — its memo deps never changed. Resolving and pinning are
 * therefore one operation, not two things a caller must remember to pair.
 *
 * This is the React side of the cache; `proceduralTextureCache` itself stays
 * React-free.
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
 * The procedural texture `ref` names — a `SubResource` naming an inline
 * `GradientTexture2D` or `NoiseTexture2D` — held resident for as long as the
 * caller is mounted. Null for every other reference form (an `ExtResource`
 * image, a `res://` path, a sub-resource of some other type, nothing at all),
 * leaving the caller's async path to handle it.
 *
 * Which slices those are is `resolveProceduralTexture`'s business, not this
 * hook's: this is the React half (memo + pin), and the walk is shared with the
 * React-free material paths.
 *
 * "Shared" reaches a consumer only if the consumer comes through here or
 * through `useTexture2D`. `resolveTexture2DSource` answers with a PATH, and a
 * procedural texture has none, so four consumers that called the resolver
 * directly — the Decal albedo, the panorama sky, the Button icon and the
 * TextureRect image — resolved such a reference to nothing and drew untextured.
 * A Texture2D slot is read through the hook for that reason.
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
 * Hold every key in `keys` resident while the caller is mounted, for consumers
 * that resolve several procedural textures at once (a material's texture slots)
 * and so cannot use `useProceduralTexture` per slot.
 *
 * The effect re-runs when the SET of keys changes, not when a caller happens to
 * rebuild the array: an unpin/pin cycle per render would flush disposals that a
 * pinned replace deliberately deferred. Keys are `token:subResourceId`, so no
 * key can contain the joining newline.
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
