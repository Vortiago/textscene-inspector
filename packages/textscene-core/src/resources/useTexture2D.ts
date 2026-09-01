/**
 * "Give me a THREE.Texture for this Texture2D-valued property."
 *
 * A Texture2D slot can hold quite different things, and until this module
 * existed every 2D caller had to know which one it had:
 *
 *   `res://…` / `ExtResource` — an image file, loaded asynchronously through
 *                               the resource pipeline
 *   `SubResource(CanvasTexture)` — a wrapper; resolves to its diffuse texture,
 *                               which is itself any of these forms
 *   `SubResource(AtlasTexture)` — a sprite-sheet cell: an image file windowed
 *                               to a region, and the size of that region
 *   `SubResource(GradientTexture2D)` — fully described inside the scene, so it
 *                               rasterises synchronously with no file at all
 *
 * The path-based `resolveTexture2DPath` + `useResource` pair covers the first
 * two and returns nothing for the others: a `SubResource` survives it only when
 * it happens to CARRY a path, so every inline procedural texture and every
 * sheet cell resolved to a missing-resource placeholder.
 *
 * The wrapping forms are peeled off one level at a time and the remainder goes
 * through the same three branches, so a cell of a sheet, a wrapped gradient and
 * a plain image all reach a consumer as one thing: a texture whose OWN size is
 * the size Godot reports for the slot.
 *
 * This hook hides the distinction: callers ask for a texture and get one (or a
 * status explaining why not). It is the ONE resolver every Texture2D-valued
 * slot should go through; `resolveTexture2DPath` is the path-only half of it,
 * correct only where the caller genuinely wants a file path.
 *
 * `inlineTexture2DSize` answers the sibling question — how big is it — for the
 * one caller that cannot use a hook, and lives here so the two answers cannot
 * drift apart again.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import {
  resolveSubResourceRef,
  resolveTexture2DPath,
  unwrapCanvasTextureRef,
} from './SubResourceResolver.js';
import { atlasTextureLayout } from './textures/atlastexture/decode.js';
import {
  resolveAtlasTexture,
  resolveAtlasTextureRef,
} from './textures/atlastexture/resolveAtlasTexture.js';
import { decodeGradientTexture2D } from './textures/gradienttexture2d/decode.js';
import { useProceduralTexture, useProceduralTexturePins } from './useProceduralTexture.js';
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
  // An AtlasTexture does not hold pixels, it windows another texture's — so the
  // slot's own reference is replaced by the sheet's for the resolution below,
  // and the window is applied to whatever that yields.
  // Unwrapped BEFORE the atlas lookup: a CanvasTexture may wrap an AtlasTexture,
  // and testing the raw ref would see only the wrapper and lose the window.
  const unwrapped = useMemo(
    () => unwrapCanvasTextureRef(ref, internalResources),
    [ref, internalResources]
  );
  const atlas = useMemo(
    () => resolveAtlasTextureRef(unwrapped, internalResources),
    [unwrapped, internalResources]
  );
  const sourceRef = useMemo(
    () => unwrapCanvasTextureRef(atlas ? atlas.texture.atlas : unwrapped, internalResources),
    [atlas, unwrapped, internalResources]
  );

  // Procedural first: it is described entirely by the scene, so it needs no
  // file and resolves in the same tick the property is read. Shared and owned
  // by the procedural cache, like any loader-supplied texture — borrowed here
  // (pinned by the hook while mounted), never disposed.
  const procedural = useProceduralTexture(sourceRef, internalResources);

  const path = useMemo(
    () =>
      procedural ? null : resolveTexture2DPath(sourceRef, externalResources, internalResources),
    [procedural, sourceRef, externalResources, internalResources]
  );
  const loaded = useResource<THREE.Texture>(path ?? '', 'Texture2D');
  const source = procedural ?? loaded.value ?? null;

  // Same borrow contract as the procedural branch: the crop is cache-owned and
  // pinned for as long as this consumer is mounted.
  const cropped = useMemo(
    () => (atlas ? resolveAtlasTexture(atlas, source, internalResources) : null),
    [atlas, source, internalResources]
  );
  useProceduralTexturePins(cropped ? [cropped.key] : []);

  if (!ref) return { texture: null, missing: false };
  const sourceMissing = !procedural && (!path || loaded.status === 'unavailable');
  if (atlas) {
    // A cell whose sheet is still loading shows nothing yet; a crop that could
    // not be cut (a zero-area region) draws nothing, exactly as Godot's own
    // `get_rect_region` decline does — neither is a resource error.
    return { texture: cropped?.texture ?? null, missing: sourceMissing };
  }
  if (procedural) return { texture: procedural, missing: false };
  if (!path) return { texture: null, missing: true };
  return { texture: loaded.value ?? null, missing: loaded.status === 'unavailable' };
}

/** Pixel dimensions of a Texture2D slot, in the `Vec2` shape the rect solver uses. */
export interface Texture2DSize {
  x: number;
  y: number;
}

/**
 * The pixel size of a Texture2D slot whose answer is written in the SCENE —
 * without rasterising anything, without loading anything and without React: the
 * answer a Control's minimum-size solve needs, which runs outside any component
 * and so cannot call `useTexture2D`. Null for every reference form whose size
 * only the loader knows (an image path, an `ExtResource`, a `CanvasTexture`
 * wrapping one), leaving the caller's cache lookup to answer those.
 *
 * Two forms carry their own size:
 *
 *  - `GradientTexture2D` — read from the DECLARED `width`/`height` rather than
 *    from a rasterised texture, for two reasons.
 *    `GradientTexture2D::get_width`/`get_height`
 *    (`scene/resources/gradient_texture.cpp`) return the authored members
 *    directly and never consult `gradient`, so a texture whose gradient does
 *    not resolve still occupies its full declared size in a container. And
 *    rasterising here would mint a `proceduralTextureCache` entry with no
 *    mounted consumer to pin it, so capacity eviction could dispose it out
 *    from under a component that IS holding it.
 *  - `AtlasTexture` — `get_width`/`get_height`
 *    (`scene/resources/atlas_texture.cpp:33-53`) report the REGION plus the
 *    margin, so a sheet cell reserves the cell's size and not the sheet's. Null
 *    when a region axis is zero, the one case Godot answers from the sheet.
 */
export function inlineTexture2DSize(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): Texture2DSize | null {
  const atlas = resolveAtlasTextureRef(ref, internalResources);
  if (atlas) {
    const layout = atlasTextureLayout(atlas.texture, null);
    return layout ? { x: layout.width, y: layout.height } : null;
  }

  const resource = resolveSubResourceRef(
    unwrapCanvasTextureRef(ref, internalResources),
    internalResources
  );
  if (resource?.type !== 'GradientTexture2D') return null;
  const { width, height } = decodeGradientTexture2D(resource.data as Record<string, string>);
  return { x: width, y: height };
}
