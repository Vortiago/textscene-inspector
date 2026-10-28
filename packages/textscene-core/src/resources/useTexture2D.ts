/**
 * The one resolver for a Texture2D slot: an image path or `ExtResource`, a `CanvasTexture`, an
 * `AtlasTexture`, `GradientTexture2D` or `NoiseTexture2D`, inline or saved as its own resource file,
 * or a `ViewportTexture`'s live target. Wrappers peel to a fixed point, and the texture's size is
 * Godot's size for the slot.
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
import { isLocalToScene, viewportTextureHolders } from './textures/viewporttexture/localToScene.js';
import { unconfiguredViewportTexture } from './textures/viewporttexture/unconfiguredViewportTexture.js';
import { atlasTextureLayout } from './textures/atlastexture/decode.js';
import {
  resolveAtlasTexture,
  resolveAtlasTextureRef,
  type AtlasTextureReference,
} from './textures/atlastexture/resolveAtlasTexture.js';
import { decodeGradientTexture2D } from './textures/gradienttexture2d/decode.js';
import { imageRefSize } from './textures/image/decode.js';
import { decodeNoiseTexture2D } from './textures/noisetexture2d/decode.js';
import { parsedResourceTexture } from './textures/parsedResourceTexture.js';
import {
  isViewportTextureRef,
  useViewportTextureSlot,
  type ViewportTextureView,
} from './textures/viewporttexture/useViewportTextureSlot.js';
import { useProceduralTexture, useProceduralTexturePins } from './useProceduralTexture.js';
import { useResource } from './useResource.js';
import { useParsedResourceSlot } from './useParsedResourceSlot.js';
import { isLiveTarget, liveTargetCrop } from '../r3f/liveTargets.js';
import { useDisposeOnRelease } from '../r3f/useDisposeOnRelease.js';
import { pinColorSpace } from './textures/textureView.js';

export interface Texture2DResult {
  /**
   * The resolved texture, or null while loading / when there is nothing to show. A ViewportTexture
   * gives its target's view, which every reader shares: a caller never clones or disposes it.
   */
  texture: THREE.Texture | null;
  /**
   * True when the slot never draws: the reference names something this renderer cannot resolve, or
   * a ViewportTexture whose target sits in an unrenderable pass cycle.
   */
  missing: boolean;
  /** True while the texture, or a file or build it waits on, is still on its way. */
  isArriving: boolean;
  /**
   * Set when the slot reaches a ViewportTexture Godot never sets up, through any wrapper, whose
   * `get_image()` is null (`viewport.cpp:180-186`). `texture` then samples the placeholder.
   */
  hasNoImage?: true;
}

/** The holders of a node's own slot: none, since `make_local_resource` sets the property up itself. */
export const NODE_PROPERTY: readonly TscnInternalResource[] = [];

/**
 * The texture a slot draws. `view` is the ViewportTexture view the slot samples: a canvas item
 * samples the plain one. `holders` are the resources between the node and `ref`, the node's
 * property first: the SpriteFrames that holds a frame.
 */
export function useTexture2D(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  view: ViewportTextureView = 'plain',
  holders: readonly TscnInternalResource[] = NODE_PROPERTY
): Texture2DResult {
  const slot = useTexture2DSlot(ref, externalResources, internalResources, view, holders);

  // The crop is cache-owned and pinned while mounted, like the procedural texture. Keyed on the
  // tables the atlas sits in, so a re-parse of the scene or of its resource file invalidates it.
  const { atlas, source, atlasResources } = slot;
  const isLiveSheet = source !== null && isLiveTarget(source);
  const cropped = useMemo(
    () => (atlas && !isLiveSheet ? resolveAtlasTexture(atlas, source, atlasResources) : null),
    [atlas, isLiveSheet, source, atlasResources]
  );
  useProceduralTexturePins(cropped ? [cropped.key] : []);
  const liveCrop = useLiveCrop(atlas, isLiveSheet ? source : null);

  if (!atlas) return slot.result;
  // A sheet still loading, or a zero-area region that Godot's `get_rect_region` also declines,
  // draws nothing and is no resource error.
  return { ...slot.result, texture: liveCrop ?? cropped?.texture ?? null };
}

/**
 * The cell `atlas` cuts out of a live target, refilled after each render of the target as Godot's
 * AtlasTexture draws from the live RID. This slot owns it and frees it once it stops drawing it.
 */
function useLiveCrop(atlas: AtlasTextureReference | null, sheet: THREE.Texture | null): THREE.Texture | null {
  const crop = useMemo(() => {
    if (!atlas || !sheet) return null;
    const layout = atlasTextureLayout(atlas.texture, sheet.image as { width: number; height: number });
    // Pinned, as the sheet is: R3F reasserts `SRGBColorSpace` on a `map` every commit.
    return layout && pinColorSpace(liveTargetCrop(sheet, layout), sheet.colorSpace as THREE.ColorSpace);
  }, [atlas, sheet]);
  useDisposeOnRelease(crop);
  return crop;
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
 * `holders` are as `useTexture2D` names them: the mesh and the material for a material slot.
 */
export function useTexture2DRid(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  view: ViewportTextureView,
  holders: readonly TscnInternalResource[]
): Texture2DRidResult {
  const { result, namesCanvasTexture } = useTexture2DSlot(
    ref,
    externalResources,
    internalResources,
    view,
    holders
  );
  return namesCanvasTexture ? CANVAS_TEXTURE_RID : { ...result, namesTexture: true };
}

const NOTHING: Texture2DResult = { texture: null, missing: false, isArriving: false };

const CANVAS_TEXTURE_RID: Texture2DRidResult = { ...NOTHING, namesTexture: false };

interface Texture2DSlot {
  /** The AtlasTexture the slot names, or null for any other form. */
  atlas: AtlasTextureReference | null;
  /** The sub-resources the atlas sits in: the scene's, or its resource file's. */
  atlasResources: readonly TscnInternalResource[];
  /** The image or procedural texture behind the slot: an AtlasTexture's sheet. */
  source: THREE.Texture | null;
  /** The slot's result with an AtlasTexture's sheet in its place. */
  result: Texture2DResult;
  /** The slot, its resource file or its AtlasTexture's sheet is a CanvasTexture, which this peeled. */
  namesCanvasTexture: boolean;
}

function useTexture2DSlot(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  view: ViewportTextureView,
  outerHolders: readonly TscnInternalResource[]
): Texture2DSlot {
  // Wrappers peel before the atlas lookup: a CanvasTexture may wrap an AtlasTexture, and the raw
  // ref loses the window. A resource file may hold either, so its `[resource]` peels again.
  const unwrapped = useMemo(() => unwrapCanvasTextureRef(ref, internalResources), [ref, internalResources]);
  const slot = useParsedResourceSlot(unwrapped, externalResources, internalResources);
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

  // A ViewportTexture names a node, not a file, so it comes from the live registry. The hook runs
  // for every slot, as the rules of hooks ask, and idles on an undefined reference.
  const isViewport = isViewportTextureRef(sourceRef, slot.internalResources);
  const holders = useMemo(
    () =>
      isViewport
        ? viewportTextureHolders(ref, internalResources, slot.ref, slot.internalResources, atlas, sourceRef)
        : [],
    [isViewport, ref, internalResources, slot.ref, slot.internalResources, atlas, sourceRef]
  );
  // Godot sets the ViewportTexture up only when every holder down to it is local to scene.
  const isSetUp = outerHolders.every(isLocalToScene) && holders.every(isLocalToScene);
  const viewport = useViewportTextureSlot(
    isViewport && isSetUp ? sourceRef : undefined,
    slot.internalResources,
    view
  );
  const unconfigured = isViewport && !isSetUp ? unconfiguredViewportTexture() : null;

  // Procedural first: the scene describes it, so no file round trip. A gradient resolves in the
  // same tick, a noise texture once its build lands. The procedural cache owns it, and this hook
  // pins it while mounted and never disposes it.
  const procedural = useProceduralTexture(sourceRef, slot.internalResources);

  // `resolveExtResourcePath`, not `resolveTexture2DPath`: `sourceRef` is already
  // at its fixed point, so that resolver's own peel could only return it again.
  const path = useMemo(
    () =>
      procedural.claimed || isViewport ? null : resolveExtResourcePath(sourceRef, slot.externalResources),
    [procedural.claimed, isViewport, sourceRef, slot.externalResources]
  );
  const loaded = useResource<THREE.Texture>(path ?? '', 'texture');
  const source = unconfigured ?? viewport.texture ?? procedural.texture ?? loaded.value ?? null;
  const atlasResources = slot.internalResources;
  // The peel returns any other reference as it is, so a changed reference names a CanvasTexture.
  const atlasSheet = atlas?.texture.atlas;
  const namesCanvasTexture =
    isPeeled(ref, unwrapped) || isPeeled(slot.ref, slotRef) || isPeeled(atlasSheet, sourceRef);
  const peeled = { atlas, atlasResources, source, namesCanvasTexture };

  if (!ref) return { ...peeled, result: NOTHING };
  // Nothing to resolve: a resource file still loading or proved absent, or a wrapper with no texture.
  if (!slot.ref) {
    const result = {
      texture: null,
      missing: slot.status === 'missing',
      isArriving: slot.status === 'loading',
    };
    return { ...peeled, result };
  }

  // A target arrives after first paint and is no file on its way, so only a cycle stops it.
  if (unconfigured)
    return { ...peeled, result: { texture: source, missing: false, isArriving: false, hasNoImage: true } };
  if (isViewport)
    return { ...peeled, result: { texture: source, missing: viewport.cyclic, isArriving: false } };
  const sourceMissing = !procedural.claimed && (!path || loaded.status === 'unavailable');
  const isArriving = procedural.claimed ? procedural.building : loaded.status === 'pending' && path !== null;
  return { ...peeled, result: { texture: source, missing: sourceMissing, isArriving } };
}

/** An empty reference peels to undefined too, but names nothing to peel. */
function isPeeled(ref: string | null | undefined, peeled: string | undefined): boolean {
  return !!ref && ref !== peeled;
}

/** Pixel dimensions of a Texture2D slot, as the `Vector2` the rect solver uses. */
interface Texture2DSize {
  x: number;
  y: number;
}

/**
 * The pixel size of a Texture2D slot that the scene states, for a Control's minimum-size solve,
 * which runs outside React. Null for a form only the loader can size: an image, a wrapper of one,
 * or a resource file (see `extResourceTexture2DSize`).
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
 * The pixel size of an `ExtResource` slot from its parsed resource file, for a caller with a synchronous
 * cache instead of hooks. Null for a file that holds no texture the scene could state inline.
 */
export function extResourceTexture2DSize(parsed: ParsedResource): Texture2DSize | null {
  const saved = parsedResourceTexture(parsed);
  return inlineTexture2DSize(saved.ref, saved.internalResources);
}
