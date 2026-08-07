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
 * two and returns nothing for the third: a `SubResource` survives it only when
 * it happens to CARRY a path (a `CanvasTexture`'s `diffuse_texture`), so every
 * inline procedural texture resolved to a missing-resource placeholder. The
 * rasteriser for them already existed but was reachable only from
 * MeshInstance3D.
 *
 * This hook hides the distinction: callers ask for a texture and get one (or a
 * status explaining why not). It is the ONE resolver every Texture2D-valued
 * slot should go through; `resolveTexture2DPath` is the path-only half of it,
 * correct only where the caller genuinely wants a file path.
 *
 * `proceduralTexture2DSize` answers the sibling question — how big is it —
 * for the one caller that cannot use a hook, and lives here so the two answers
 * cannot drift apart again.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { resolveSubResourceRef, resolveTexture2DPath } from './SubResourceResolver.js';
import { parseGradientTexture2D } from './textures/gradienttexture2d/parser.js';
import { useProceduralTexture } from './useProceduralTexture.js';
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
  // by the procedural cache, like any loader-supplied texture — borrowed here
  // (pinned by the hook while mounted), never disposed.
  const procedural = useProceduralTexture(ref, internalResources);

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

/** Pixel dimensions of a Texture2D slot, in the `Vec2` shape the rect solver uses. */
export interface Texture2DSize {
  x: number;
  y: number;
}

/**
 * The pixel size of an inline procedural texture, without rasterising it and
 * without React — the answer a Control's minimum-size solve needs, which runs
 * outside any component and so cannot call `useTexture2D`. Null for every
 * reference form whose size only the loader knows (an image path, an
 * `ExtResource`, a `CanvasTexture` wrapping one), leaving the caller's cache
 * lookup to answer those.
 *
 * Read from the DECLARED `width`/`height` rather than from a rasterised
 * texture, for two reasons:
 *
 *  - `GradientTexture2D::get_width`/`get_height`
 *    (`scene/resources/gradient_texture.cpp`) return the authored members
 *    directly and never consult `gradient`, so a texture whose gradient does
 *    not resolve still occupies its full declared size in a container.
 *  - Rasterising here would mint a `proceduralTextureCache` entry with no
 *    mounted consumer to pin it, and capacity eviction would then dispose it
 *    out from under a component that IS holding it.
 */
export function proceduralTexture2DSize(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): Texture2DSize | null {
  const resource = resolveSubResourceRef(ref, internalResources);
  if (resource?.type !== 'GradientTexture2D') return null;
  const { width, height } = parseGradientTexture2D(resource.data as Record<string, string>);
  return { x: width, y: height };
}
