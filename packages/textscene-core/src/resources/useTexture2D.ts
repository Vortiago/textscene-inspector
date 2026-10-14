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
  resolveExtResourcePath,
  resolveSubResourceRef,
  unwrapCanvasTextureRef,
} from './SubResourceResolver.js';
import { atlasTextureLayout } from './textures/atlastexture/decode.js';
import {
  resolveAtlasTexture,
  resolveAtlasTextureRef,
  type AtlasTextureReference,
} from './textures/atlastexture/resolveAtlasTexture.js';
import { decodeGradientTexture2D } from './textures/gradienttexture2d/decode.js';
import { imageRefSize } from './textures/image/decode.js';
import { decodeNoiseTexture2D } from './textures/noisetexture2d/decode.js';
import { textResourceTexture } from './textures/textResourceTexture.js';
import { useProceduralTexture, useProceduralTexturePins } from './useProceduralTexture.js';
import { useResource } from './useResource.js';
import { useTextResourceSlot } from './useTextResourceSlot.js';

export interface Texture2DResult {
  /** The resolved texture, or null while loading / when there is nothing to show. */
  texture: THREE.Texture | null;
  /** True when the reference names something this renderer cannot resolve. */
  missing: boolean;
  /** True while the texture, or a file or build it waits on, is still on its way. */
  isArriving: boolean;
}

export function useTexture2D(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): Texture2DResult {
  const slot = useTexture2DSlot(ref, externalResources, internalResources);

  // The crop is cache-owned and pinned while mounted, like the procedural texture. Keyed on the
  // tables the atlas sits in, so a re-parse of the scene or of its `.tres` invalidates it.
  const { atlas, source, atlasResources } = slot;
  const cropped = useMemo(
    () => (atlas ? resolveAtlasTexture(atlas, source, atlasResources) : null),
    [atlas, source, atlasResources]
  );
  useProceduralTexturePins(cropped ? [cropped.key] : []);

  if (!atlas) return slot.result;
  // A sheet still loading, or a zero-area region that Godot's `get_rect_region` also declines,
  // draws nothing and is no resource error.
  return { ...slot.result, texture: cropped?.texture ?? null };
}

export interface Texture2DRidResult extends Texture2DResult {
  /**
   * False when the RID names a CanvasTexture, a canvas object no texture owner holds
   * (`scene/main/canvas_item.cpp:1919-1921`). A sampler bound to it reads Godot's white default
   * (`material_storage.cpp:1094-1096`).
   */
  namesTexture: boolean;
}

/**
 * The texture Godot's `get_rid()` names, for a slot the rendering server reads by RID. An
 * AtlasTexture names its whole sheet there (`scene/resources/atlas_texture.cpp:55-61`).
 */
export function useTexture2DRid(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): Texture2DRidResult {
  const { result, namesCanvasTexture } = useTexture2DSlot(ref, externalResources, internalResources);
  return namesCanvasTexture ? CANVAS_TEXTURE_RID : { ...result, namesTexture: true };
}

const NOTHING: Texture2DResult = { texture: null, missing: false, isArriving: false };

const CANVAS_TEXTURE_RID: Texture2DRidResult = { ...NOTHING, namesTexture: false };

interface Texture2DSlot {
  /** The AtlasTexture the slot names, or null for any other form. */
  atlas: AtlasTextureReference | null;
  /** The sub-resources the atlas sits in: the scene's, or its `.tres` file's. */
  atlasResources: readonly TscnInternalResource[];
  /** The image or procedural texture behind the slot: an AtlasTexture's sheet. */
  source: THREE.Texture | null;
  /** The slot's result with an AtlasTexture's sheet in its place. */
  result: Texture2DResult;
  /** The slot, its `.tres` or its AtlasTexture's sheet is a CanvasTexture, which this peeled. */
  namesCanvasTexture: boolean;
}

function useTexture2DSlot(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): Texture2DSlot {
  // Wrappers peel before the atlas lookup: a CanvasTexture may wrap an AtlasTexture, and the raw
  // ref loses the window. A `.tres` may hold either, so its `[resource]` peels again.
  const unwrapped = useMemo(() => unwrapCanvasTextureRef(ref, internalResources), [ref, internalResources]);
  const slot = useTextResourceSlot(unwrapped, externalResources, internalResources);
  const slotRef = useMemo(
    () => unwrapCanvasTextureRef(slot.ref, slot.internalResources),
    [slot.ref, slot.internalResources]
  );
  // An AtlasTexture windows the sheet it names, an ordinary Texture2D slot with the same unwrap.
  const atlas = useMemo(
    () => resolveAtlasTextureRef(slotRef, slot.internalResources),
    [slotRef, slot.internalResources]
  );
  const sourceRef = useMemo(
    () => (atlas ? unwrapCanvasTextureRef(atlas.texture.atlas, slot.internalResources) : slotRef),
    [atlas, slot.internalResources, slotRef]
  );

  // Procedural first: the scene describes it, so no file round trip. A gradient resolves in the
  // same tick, a noise texture once its build lands. The procedural cache owns it, and this hook
  // pins it while mounted and never disposes it.
  const procedural = useProceduralTexture(sourceRef, slot.internalResources);

  // `resolveExtResourcePath`, not `resolveTexture2DPath`: `sourceRef` is already
  // at its fixed point, so that resolver's own peel could only return it again.
  const path = useMemo(
    () => (procedural.claimed ? null : resolveExtResourcePath(sourceRef, slot.externalResources)),
    [procedural.claimed, sourceRef, slot.externalResources]
  );
  const loaded = useResource<THREE.Texture>(path ?? '', 'texture');
  const source = procedural.texture ?? loaded.value ?? null;
  const atlasResources = slot.internalResources;
  // The peel returns any other reference as it is, so a changed reference names a CanvasTexture.
  const atlasSheet = atlas?.texture.atlas;
  const namesCanvasTexture =
    isPeeled(ref, unwrapped) || isPeeled(slot.ref, slotRef) || isPeeled(atlasSheet, sourceRef);
  const peeled = { atlas, atlasResources, source, namesCanvasTexture };

  if (!ref) return { ...peeled, result: NOTHING };
  // Nothing to resolve: a `.tres` still loading or proved absent, or a wrapper with no texture.
  if (!slot.ref) {
    const result = {
      texture: null,
      missing: slot.status === 'missing',
      isArriving: slot.status === 'loading',
    };
    return { ...peeled, result };
  }

  const sourceMissing = !procedural.claimed && (!path || loaded.status === 'unavailable');
  const isArriving = procedural.claimed ? procedural.building : loaded.status === 'pending' && path !== null;
  return { ...peeled, result: { texture: source, missing: sourceMissing, isArriving } };
}

/** An empty reference peels to undefined too, but names nothing to peel. */
function isPeeled(ref: string | null | undefined, peeled: string | undefined): boolean {
  return !!ref && ref !== peeled;
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
  const decode = resource && DECLARED_SIZES[resource.type];
  if (decode) {
    const { width, height } = decode(resource.data);
    return { x: width, y: height };
  }
  // An ImageTexture's size is its image's (`scene/resources/image_texture.cpp:74-75`, `:122-128`).
  const image =
    resource?.type === 'ImageTexture' ? imageRefSize(resource.data.image, internalResources) : null;
  return image ? { x: image.width, y: image.height } : null;
}

/** The texture types whose properties state their size. */
const DECLARED_SIZES: Readonly<
  Record<string, (data: Record<string, string>) => { width: number; height: number }>
> = {
  GradientTexture2D: decodeGradientTexture2D,
  NoiseTexture2D: decodeNoiseTexture2D,
};

/**
 * The pixel size of an `ExtResource` slot from its parsed `.tres`, for a caller with a synchronous
 * cache instead of hooks. Null for a `.tres` that holds no texture the scene could state inline.
 */
export function extResourceTexture2DSize(tres: ParsedResource): Texture2DSize | null {
  const saved = textResourceTexture(tres);
  return inlineTexture2DSize(saved.ref, saved.internalResources);
}
