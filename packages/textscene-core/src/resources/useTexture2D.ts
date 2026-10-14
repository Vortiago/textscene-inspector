/**
 * The one resolver for a Texture2D slot: an image path or `ExtResource`, a `CanvasTexture`, or an
 * `AtlasTexture`, `GradientTexture2D` or `NoiseTexture2D`, inline or saved as its own `.tres`.
 * Wrappers peel to a fixed point, and the texture's size is Godot's size for the slot.
 * `resolveTexture2DPath` suits only a caller that wants a file path. `inlineTexture2DSize` sits
 * here so the size cannot drift.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import type { ParsedResource } from '../parser/parsedResource.js';
import {
  resolveExtTextResourcePath,
  resolveExtResourcePath,
  resolveSubResourceRef,
  unwrapCanvasTextureRef,
} from './SubResourceResolver.js';
import { atlasTextureLayout, decodeAtlasTexture } from './textures/atlastexture/decode.js';
import {
  decodeExtAtlasTextureRef,
  resolveAtlasTexture,
  resolveAtlasTextureRef,
  type AtlasTextureReference,
} from './textures/atlastexture/resolveAtlasTexture.js';
import { ATLAS_TEXTURE_TYPE } from './textures/atlastexture/types.js';
import { decodeGradientTexture2D } from './textures/gradienttexture2d/decode.js';
import { decodeNoiseTexture2D } from './textures/noisetexture2d/decode.js';
import { textResourceTexture } from './textures/textResourceTexture.js';
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
  const slot = useTexture2DSlot(ref, externalResources, internalResources);

  // The crop is cache-owned and pinned while mounted, like the procedural texture. Keyed on the
  // previewed scene's resources: its re-parse invalidates the crop, a `.tres` reload does not.
  const { atlas, source } = slot;
  const cropped = useMemo(
    () => (atlas ? resolveAtlasTexture(atlas, source, internalResources) : null),
    [atlas, source, internalResources]
  );
  useProceduralTexturePins(cropped ? [cropped.key] : []);

  if (!atlas) return slot.result;
  // A sheet still loading, or a zero-area region that Godot's `get_rect_region` also declines,
  // draws nothing and is no resource error.
  return { texture: cropped?.texture ?? null, missing: slot.result.missing };
}

/**
 * The texture Godot's `get_rid()` names, for a slot the rendering server reads by RID. An
 * AtlasTexture names its whole sheet there (`scene/resources/atlas_texture.cpp:55-61`).
 */
export function useTexture2DRid(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): Texture2DResult {
  return useTexture2DSlot(ref, externalResources, internalResources).result;
}

interface Texture2DSlot {
  /** The AtlasTexture the slot names, or null for any other form. */
  atlas: AtlasTextureReference | null;
  /** The image or procedural texture behind the slot: an AtlasTexture's sheet. */
  source: THREE.Texture | null;
  /** The slot's result with an AtlasTexture's sheet in its place. */
  result: Texture2DResult;
}

function useTexture2DSlot(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): Texture2DSlot {
  // An AtlasTexture windows the sheet it names, so the sheet's ref resolves below. Unwrapped before
  // the atlas lookup: a CanvasTexture may wrap an AtlasTexture, and the raw ref loses the window.
  const unwrapped = useMemo(() => unwrapCanvasTextureRef(ref, internalResources), [ref, internalResources]);
  const inlineAtlas = useMemo(
    () => resolveAtlasTextureRef(unwrapped, internalResources),
    [unwrapped, internalResources]
  );

  // A `.tres`, which loads on the `resource` bus, since the image bus cannot decode text. Its own
  // header says what it holds: an AtlasTexture, or a texture its own tables describe.
  const textResourcePath = useMemo(
    () => (inlineAtlas ? null : resolveExtTextResourcePath(unwrapped, externalResources)),
    [inlineAtlas, unwrapped, externalResources]
  );
  const textResourceFile = useResource<ParsedResource>(textResourcePath ?? '', 'resource');
  const extAtlas = useMemo(
    () =>
      textResourcePath && textResourceFile.value
        ? decodeExtAtlasTextureRef(textResourcePath, textResourceFile.value)
        : null,
    [textResourcePath, textResourceFile.value]
  );
  const saved =
    textResourcePath && textResourceFile.value ? textResourceTexture(textResourceFile.value) : null;

  const atlas = inlineAtlas ?? extAtlas;
  // A `.tres` file's ids are its own, so its refs resolve against its own resource tables.
  const externalResourcesForSource = saved?.externalResources ?? externalResources;
  const internalResourcesForSource = saved?.internalResources ?? internalResources;

  // The sheet is an ordinary Texture2D slot, so it gets the same unwrap. A `.tres` still loading
  // names nothing yet.
  const sourceRef = useMemo(() => {
    if (textResourcePath && !textResourceFile.value) return undefined;
    if (atlas) return unwrapCanvasTextureRef(atlas.texture.atlas, internalResourcesForSource);
    return saved?.ref ?? unwrapped;
  }, [textResourcePath, textResourceFile.value, atlas, internalResourcesForSource, saved, unwrapped]);

  // Procedural first: the scene describes it, so no file round trip. A gradient resolves in the
  // same tick, a noise texture once its build lands. The procedural cache owns it, and this hook
  // pins it while mounted and never disposes it.
  const procedural = useProceduralTexture(sourceRef, internalResourcesForSource);

  // `resolveExtResourcePath`, not `resolveTexture2DPath`: `sourceRef` is already
  // at its fixed point, so that resolver's own peel could only return it again.
  const path = useMemo(
    () => (procedural.claimed ? null : resolveExtResourcePath(sourceRef, externalResourcesForSource)),
    [procedural.claimed, sourceRef, externalResourcesForSource]
  );
  const loaded = useResource<THREE.Texture>(path ?? '', 'texture');
  const source = procedural.texture ?? loaded.value ?? null;

  if (!ref) return { atlas, source, result: { texture: null, missing: false } };

  if (textResourcePath && !textResourceFile.value) {
    // Missing only once the file leaves 'pending': it is absent.
    return { atlas, source, result: { texture: null, missing: textResourceFile.status !== 'pending' } };
  }

  const sourceMissing = !procedural.claimed && (!path || loaded.status === 'unavailable');
  return { atlas, source, result: { texture: source, missing: sourceMissing } };
}

/** Pixel dimensions of a Texture2D slot, in the `Vec2` shape the rect solver uses. */
export interface Texture2DSize {
  x: number;
  y: number;
}

/**
 * The pixel size of a Texture2D slot that the scene states, for a Control's minimum-size solve,
 * which runs outside React. Null for a form only the loader can size: an image, a wrapper of one,
 * or a `.tres` (see `extResourceTexture2DSize`).
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

  // The declared size: neither getter consults the texture's source
  // (`scene/resources/gradient_texture.cpp`, `modules/noise/noise_texture_2d.cpp:378-384`), and
  // building one here mints a cache entry no consumer pins, open to eviction.
  const resource = resolveSubResourceRef(unwrapped, internalResources);
  if (resource?.type === 'GradientTexture2D') {
    const { width, height } = decodeGradientTexture2D(resource.data);
    return { x: width, y: height };
  }
  if (resource?.type === 'NoiseTexture2D') {
    const { width, height } = decodeNoiseTexture2D(resource.data);
    return { x: width, y: height };
  }
  return null;
}

/**
 * The pixel size of an `ExtResource` slot from its parsed `.tres`, for a caller with a synchronous
 * cache instead of hooks. `sheetSize` answers an AtlasTexture's zero region axis, and null leaves
 * it unanswered. Null for a `.tres` that holds no texture the scene could state inline.
 */
export function extResourceTexture2DSize(
  tres: ParsedResource,
  sheetSize: { width: number; height: number } | null
): Texture2DSize | null {
  if (tres.resourceType === ATLAS_TEXTURE_TYPE) {
    const layout = atlasTextureLayout(decodeAtlasTexture(tres.properties), sheetSize);
    return layout ? { x: layout.width, y: layout.height } : null;
  }
  const saved = textResourceTexture(tres);
  return inlineTexture2DSize(saved.ref, saved.internalResources);
}
