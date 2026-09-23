/**
 * The one resolver for a Texture2D slot: an image path or `ExtResource`, a `CanvasTexture`, an
 * `AtlasTexture` inline or as a `.tres`, or an inline `GradientTexture2D`. Wrappers peel to a fixed
 * point, and the texture's size is Godot's size for the slot. `resolveTexture2DPath` suits only a
 * caller that wants a file path. `inlineTexture2DSize` sits here so the size cannot drift.
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
  // An AtlasTexture windows the sheet it names, so the sheet's ref resolves below. Unwrapped before
  // the atlas lookup: a CanvasTexture may wrap an AtlasTexture, and the raw ref loses the window.
  const unwrapped = useMemo(
    () => unwrapCanvasTextureRef(ref, internalResources),
    [ref, internalResources]
  );
  const inlineAtlas = useMemo(
    () => resolveAtlasTextureRef(unwrapped, internalResources),
    [unwrapped, internalResources]
  );

  // An AtlasTexture `.tres`, known from the ExtResource's `type=` before any fetch. It loads on the
  // `resource` bus, since the image bus cannot decode text.
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
  // A `.tres` file's ids are its own, so its `atlas` ref resolves against its own resource tables.
  const externalResourcesForAtlas =
    extAtlas && extAtlasFile.value ? extAtlasFile.value.extResources : externalResources;
  const internalResourcesForAtlas =
    extAtlas && extAtlasFile.value ? extAtlasFile.value.subResources : internalResources;

  // The sheet is an ordinary Texture2D slot, so it gets the same unwrap. A `.tres` still loading
  // names nothing yet.
  const sourceRef = useMemo(() => {
    if (extAtlasPath && !extAtlas) return undefined;
    if (atlas) return unwrapCanvasTextureRef(atlas.texture.atlas, internalResourcesForAtlas);
    return unwrapped;
  }, [extAtlasPath, extAtlas, atlas, internalResourcesForAtlas, unwrapped]);

  // Procedural first: the scene describes it, so it resolves in the same tick. The procedural cache
  // owns it, and this hook pins it while mounted and never disposes it.
  const procedural = useProceduralTexture(sourceRef, internalResourcesForAtlas);

  // `resolveExtResourcePath`, not `resolveTexture2DPath`: `sourceRef` is already
  // at its fixed point, so that resolver's own peel could only return it again.
  const path = useMemo(
    () => (procedural ? null : resolveExtResourcePath(sourceRef, externalResourcesForAtlas)),
    [procedural, sourceRef, externalResourcesForAtlas]
  );
  const loaded = useResource<THREE.Texture>(path ?? '', 'texture');
  const source = procedural ?? loaded.value ?? null;

  // The crop is cache-owned and pinned while mounted, like the procedural texture. Keyed on the
  // previewed scene's resources: its re-parse invalidates the crop, a `.tres` reload does not.
  const cropped = useMemo(
    () => (atlas ? resolveAtlasTexture(atlas, source, internalResources) : null),
    [atlas, source, internalResources]
  );
  useProceduralTexturePins(cropped ? [cropped.key] : []);

  if (!ref) return { texture: null, missing: false };

  if (extAtlasPath && !extAtlas) {
    // Missing only once `extAtlasFile` leaves 'pending': the file is absent or another type.
    return { texture: null, missing: extAtlasFile.status !== 'pending' };
  }

  const sourceMissing = !procedural && (!path || loaded.status === 'unavailable');
  if (atlas) {
    // A sheet still loading, or a zero-area region that Godot's `get_rect_region` also declines,
    // draws nothing and is no resource error.
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
 * The pixel size of a Texture2D slot that the scene states, for a Control's minimum-size solve,
 * which runs outside React. Null for a form only the loader can size: an image, a wrapper of one,
 * or an AtlasTexture `.tres` (see `extResourceAtlasTextureSize`).
 */
export function inlineTexture2DSize(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): Texture2DSize | null {
  // Unwrapped before the atlas lookup, as in the hook: the raw ref would answer the sheet's size.
  const unwrapped = unwrapCanvasTextureRef(ref, internalResources);
  const atlas = resolveAtlasTextureRef(unwrapped, internalResources);
  if (atlas) {
    // Region plus margin (`scene/resources/atlas_texture.cpp:33-53`), so a cell reserves the
    // cell's size. Null when a region axis is zero, where Godot uses the sheet.
    const layout = atlasTextureLayout(atlas.texture, null);
    return layout ? { x: layout.width, y: layout.height } : null;
  }

  const resource = resolveSubResourceRef(unwrapped, internalResources);
  if (resource?.type !== 'GradientTexture2D') return null;
  // The declared size: Godot's getters (`scene/resources/gradient_texture.cpp`) never consult
  // `gradient`, and rasterising here mints a cache entry no consumer pins, open to eviction.
  const { width, height } = decodeGradientTexture2D(resource.data as Record<string, string>);
  return { x: width, y: height };
}

/**
 * The pixel size of an `ExtResource(AtlasTexture)` slot from its parsed `.tres`, for a caller with
 * a synchronous cache instead of hooks. `sheetSize` answers a zero region axis, and null leaves it
 * unanswered. Null for a `.tres` of another type, like `decodeExtAtlasTextureRef`.
 */
export function extResourceAtlasTextureSize(
  tres: ParsedResource,
  sheetSize: { width: number; height: number } | null
): Texture2DSize | null {
  if (tres.resourceType !== ATLAS_TEXTURE_TYPE) return null;
  const layout = atlasTextureLayout(decodeAtlasTexture(tres.properties), sheetSize);
  return layout ? { x: layout.width, y: layout.height } : null;
}
