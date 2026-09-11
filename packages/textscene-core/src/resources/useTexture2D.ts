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
 *   `ExtResource(AtlasTexture)` — the same cell, saved as its OWN `.tres`
 *                               instead of inline (every Kenney input-prompt
 *                               icon ships this way); fetched and parsed
 *                               through the `resource` bus, not the image one
 *   `SubResource(GradientTexture2D)` — fully described inside the scene, so it
 *                               rasterises synchronously with no file at all
 *
 * The path-based `resolveTexture2DPath` + `useResource` pair covers the first
 * two and returns nothing for the others: a `SubResource` survives it only when
 * it happens to CARRY a path, so every inline procedural texture and every
 * sheet cell resolved to a missing-resource placeholder.
 *
 * The wrapping forms are peeled off to a fixed point and the remainder goes
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
import type { ParsedResource } from '../parser/parsedResource.js';
import {
  resolveExtAtlasTexturePath,
  resolveExtResourcePath,
  resolveSubResourceRef,
  unwrapCanvasTextureRef,
} from './SubResourceResolver.js';
import { atlasTextureLayout, decodeAtlasTexture } from './textures/atlastexture/decode.js';
import {
  decodeExtAtlasTextureRef,
  resolveAtlasTexture,
  resolveAtlasTextureRef,
} from './textures/atlastexture/resolveAtlasTexture.js';
import { ATLAS_TEXTURE_TYPE } from './textures/atlastexture/types.js';
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
  const inlineAtlas = useMemo(
    () => resolveAtlasTextureRef(unwrapped, internalResources),
    [unwrapped, internalResources]
  );

  // The same cell, saved as its own `.tres` instead of an inline sub-resource.
  // The outer ExtResource's declared `type=` says so before anything is
  // fetched; the file is then fetched + parsed on the `resource` bus, never
  // the image one, which cannot decode text.
  const extAtlasPath = useMemo(
    () => (inlineAtlas ? null : resolveExtAtlasTexturePath(unwrapped, externalResources)),
    [inlineAtlas, unwrapped, externalResources]
  );
  const extAtlasFile = useResource<ParsedResource>(extAtlasPath ?? '', 'resource');
  const extAtlas = useMemo(
    () =>
      extAtlasPath && extAtlasFile.value
        ? decodeExtAtlasTextureRef(extAtlasPath, extAtlasFile.value)
        : null,
    [extAtlasPath, extAtlasFile.value]
  );

  const atlas = inlineAtlas ?? extAtlas;
  // A `.tres` file's ids are foreign to the scene referencing it, so its OWN
  // `atlas` ref resolves against ITS OWN ext/sub-resource tables — never the
  // referencing scene's, which the inline form uses instead.
  const externalResourcesForAtlas =
    extAtlas && extAtlasFile.value ? extAtlasFile.value.extResources : externalResources;
  const internalResourcesForAtlas =
    extAtlas && extAtlasFile.value ? extAtlasFile.value.subResources : internalResources;

  // The sheet a window names is an ordinary Texture2D slot, so it gets the same
  // unwrap; `unwrapped` is already at its fixed point. Still resolving the
  // `.tres` file itself names nothing yet to peel or load.
  const sourceRef = useMemo(() => {
    if (extAtlasPath && !extAtlas) return undefined;
    if (atlas) return unwrapCanvasTextureRef(atlas.texture.atlas, internalResourcesForAtlas);
    return unwrapped;
  }, [extAtlasPath, extAtlas, atlas, internalResourcesForAtlas, unwrapped]);

  // Procedural first: it is described entirely by the scene, so it needs no
  // file and resolves in the same tick the property is read. Shared and owned
  // by the procedural cache, like any loader-supplied texture — borrowed here
  // (pinned by the hook while mounted), never disposed.
  const procedural = useProceduralTexture(sourceRef, internalResourcesForAtlas);

  // `resolveExtResourcePath`, not `resolveTexture2DPath`: `sourceRef` is already
  // at its fixed point, so that resolver's own peel could only return it again.
  const path = useMemo(
    () => (procedural ? null : resolveExtResourcePath(sourceRef, externalResourcesForAtlas)),
    [procedural, sourceRef, externalResourcesForAtlas]
  );
  const loaded = useResource<THREE.Texture>(path ?? '', 'texture');
  const source = procedural ?? loaded.value ?? null;

  // Same borrow contract as the procedural branch: the crop is cache-owned and
  // pinned for as long as this consumer is mounted. Keyed off the PARENT
  // scene regardless of which form `atlas` came from — a re-parse of the
  // scene being previewed is what should invalidate the crop, not a reload of
  // an ext atlas's own (unrelated) `.tres`.
  const cropped = useMemo(
    () => (atlas ? resolveAtlasTexture(atlas, source, internalResources) : null),
    [atlas, source, internalResources]
  );
  useProceduralTexturePins(cropped ? [cropped.key] : []);

  if (!ref) return { texture: null, missing: false };

  if (extAtlasPath && !extAtlas) {
    // The `.tres` itself hasn't resolved yet: nothing to show, not an error.
    // A genuine failure — the file is missing, or is some other resource
    // type — settles once `extAtlasFile` leaves 'pending'.
    return { texture: null, missing: extAtlasFile.status !== 'pending' };
  }

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
 * only the loader knows (an image path, an `ExtResource` image, a
 * `CanvasTexture` wrapping one) — an `ExtResource(AtlasTexture)` `.tres` among
 * them, since its region lives in a file this function does not load;
 * `extResourceAtlasTextureSize` below is its sibling for a caller that already
 * has that file parsed. Leaves the caller's cache lookup to answer the rest.
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
  // Unwrapped BEFORE the atlas lookup, exactly as the hook above does it: a
  // CanvasTexture may wrap an AtlasTexture, and testing the raw ref would see
  // only the wrapper and answer with the whole sheet's size.
  const unwrapped = unwrapCanvasTextureRef(ref, internalResources);
  const atlas = resolveAtlasTextureRef(unwrapped, internalResources);
  if (atlas) {
    const layout = atlasTextureLayout(atlas.texture, null);
    return layout ? { x: layout.width, y: layout.height } : null;
  }

  const resource = resolveSubResourceRef(unwrapped, internalResources);
  if (resource?.type !== 'GradientTexture2D') return null;
  const { width, height } = decodeGradientTexture2D(resource.data as Record<string, string>);
  return { x: width, y: height };
}

/**
 * The pixel size of an `ExtResource(AtlasTexture)` `.tres` slot, once the file
 * itself is parsed — `inlineTexture2DSize`'s sibling for that one reference
 * form, which needs a load and so cannot answer from the scene alone. A
 * caller with a synchronous `ParsedResource`/texture cache instead of hooks
 * (`buildSolveTree.ts`'s minimum-size solve, in place of `useTexture2D`) can
 * pass `tres` once `loader.resources.getCached(path)` has it, and `sheetSize`
 * once `loader.textures.getCached(sheetPath)` does — both still to be wired
 * in there, since that solve has no access to either cache's OTHER entries
 * today. Null for a `.tres` whose own header names something other than
 * `AtlasTexture`, exactly like `decodeExtAtlasTextureRef`.
 */
export function extResourceAtlasTextureSize(
  tres: ParsedResource,
  sheetSize: { width: number; height: number } | null
): Texture2DSize | null {
  if (tres.resourceType !== ATLAS_TEXTURE_TYPE) return null;
  const layout = atlasTextureLayout(decodeAtlasTexture(tres.properties), sheetSize);
  return layout ? { x: layout.width, y: layout.height } : null;
}
