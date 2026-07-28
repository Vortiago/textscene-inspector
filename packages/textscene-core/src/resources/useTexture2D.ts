/**
 * "Give me a THREE.Texture for this Texture2D-valued property."
 *
 * A Texture2D slot can hold three quite different things, and until this module
 * existed every 2D caller had to know which one it had:
 *
 *   `res://…` / `ExtResource` — an image file, loaded asynchronously through
 *                               the resource pipeline
 *   `SubResource(CanvasTexture)` — resolves to its diffuse image, same path
 *   `SubResource(GradientTexture2D)` — fully described inside the scene, so it
 *                               rasterises synchronously with no file at all
 *
 * The path-based `resolveTexture2DPath` + `useResource` pair covers the first
 * two and returns nothing for the third, which is why the isometric dungeon's
 * 23 PointLight2Ds — every one of them a GradientTexture2D cookie — resolved to
 * a missing-resource placeholder. The rasteriser for them already existed but
 * was reachable only from MeshInstance3D.
 *
 * This hook hides the distinction: callers ask for a texture and get one (or a
 * status explaining why not).
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { resolveTexture2DPath } from './SubResourceResolver.js';
import {
  gradientTextureCacheKey,
  resolveGradientTexture2D,
} from './textures/gradienttexture2d/resolveGradientTexture.js';
import {
  pinProceduralTexture,
  unpinProceduralTexture,
} from './textures/proceduralTextureCache.js';
import { useResource } from './useResource.js';

export interface Texture2DResult {
  /** The resolved texture, or null while loading / when there is nothing to show. */
  texture: THREE.Texture | null;
  /** True when the reference names something this renderer cannot resolve. */
  missing: boolean;
}

export function useTexture2D(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): Texture2DResult {
  // Procedural first: it is described entirely by the scene, so it needs no
  // file and resolves in the same tick the property is read. Shared and owned
  // by the procedural cache, like any loader-supplied texture — borrowed here,
  // never disposed.
  const procedural = useMemo(
    () => resolveGradientTexture2D(ref, internalResources),
    [ref, internalResources]
  );

  // Borrowed, but the cache can only honour that if it knows we hold it: an
  // unpinned entry is disposed outright once the cache overflows, leaving this
  // consumer sampling a dead texture with no reason to re-rasterise.
  const proceduralKey = useMemo(
    () => (procedural ? gradientTextureCacheKey(ref, internalResources) : null),
    [procedural, ref, internalResources]
  );
  useEffect(() => {
    if (!proceduralKey) return undefined;
    pinProceduralTexture(proceduralKey);
    return () => unpinProceduralTexture(proceduralKey);
  }, [proceduralKey]);

  const path = useMemo(
    () => (procedural ? null : resolveTexture2DPath(ref, externalResources, internalResources)),
    [procedural, ref, externalResources, internalResources]
  );
  const loaded = useResource<THREE.Texture>(path ?? '', 'Texture2D');

  if (procedural) return { texture: procedural, missing: false };
  if (!ref) return { texture: null, missing: false };
  if (!path) return { texture: null, missing: true };
  return { texture: loaded.value ?? null, missing: loaded.status === 'unavailable' };
}
