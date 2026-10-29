/**
 * The one resolver for a Texture2D slot: an image path or `ExtResource`, a `CanvasTexture`, an
 * `AtlasTexture`, `GradientTexture2D` or `NoiseTexture2D`, inline or saved as its own resource file,
 * or a `ViewportTexture`'s live target. Wrappers peel to a fixed point, and the texture's size is
 * Godot's size for the slot.
 * `resolveTexture2DPath` suits only a caller that wants a file path. `inlineTexture2DSize` sizes a
 * slot outside React by the same rule.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import {
  findSubResource,
  peelCanvasTextures,
  resolveExtResourcePath,
  resolveSubResourceRef,
} from './SubResourceResolver.js';
import { isLocalToScene } from './textures/viewporttexture/localToScene.js';
import { unconfiguredViewportTexture } from './textures/viewporttexture/unconfiguredViewportTexture.js';
import { atlasTextureSize } from './textures/atlastexture/decode.js';
import { imageSize, type ImageSize } from './formats/image/imagePixels.js';
import {
  resolveAtlasTexture,
  resolveAtlasTextureRef,
  type AtlasTextureReference,
} from './textures/atlastexture/resolveAtlasTexture.js';
import {
  isViewportTextureRef,
  useViewportTextureSlot,
  type ViewportTextureView,
} from './textures/viewporttexture/useViewportTextureSlot.js';
import { useProceduralTexture, useProceduralTexturePins } from './useProceduralTexture.js';
import { useResource } from './useResource.js';
import { useTextureSources } from './useTextureSources.js';
import { useParsedResourceSlot } from './useParsedResourceSlot.js';
import { isLiveTarget } from '../r3f/liveTargets.js';
import { useDisposeOnRelease } from '../r3f/useDisposeOnRelease.js';

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
   * The size Godot reports for the texture: its image's, an AtlasTexture's region's, or 0 by 0 for
   * a ViewportTexture its scene never sets up, which samples the placeholder (`viewport.cpp:150-166`).
   * Undefined while there is no texture.
   */
  size?: ImageSize;
  /**
   * Set when the slot reaches a ViewportTexture Godot never sets up, through any wrapper, whose
   * `get_image()` is null (`viewport.cpp:180-186`). `texture` then samples the placeholder.
   */
  hasNoImage?: true;
}

/**
 * `isHeldLocally` for a node's own slot: `make_local_resource` sets the property up itself, as if
 * every resource between were local to scene.
 */
export const NODE_PROPERTY = true;

/**
 * The texture a slot draws. `view` is the ViewportTexture view the slot samples: a canvas item
 * samples the plain one. `isHeldLocally` is false when a resource between the node and `ref`, such
 * as the SpriteFrames that holds a frame, is not local to scene.
 */
export function useTexture2D(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  view: ViewportTextureView = 'plain',
  isHeldLocally: boolean = NODE_PROPERTY
): Texture2DResult {
  const slot = useTexture2DSlot(ref, externalResources, internalResources, view, isHeldLocally);

  // A loaded sheet's crop is cache-owned and pinned while mounted, like the procedural texture, and
  // a live target's is held. Keyed on the tables the atlas sits in, so a re-parse of the scene or of
  // its resource file invalidates it, and on whether the sheet is live, which picks the crop.
  const { atlas, source, atlasResources } = slot;
  const isLiveSheet = source !== null && isLiveTarget(source);
  const cropped = useMemo(
    () => (atlas ? resolveAtlasTexture(atlas, source, atlasResources) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the resolver reads whether the sheet is live.
    [atlas, source, atlasResources, isLiveSheet]
  );
  useProceduralTexturePins(cropped?.key ? [cropped.key] : []);
  useDisposeOnRelease(cropped?.key === null ? cropped.texture : null);

  // A sheet still loading, or a zero-area region that Godot's `get_rect_region` also declines,
  // draws nothing and is no resource error.
  const texture = atlas ? (cropped?.texture ?? null) : slot.result.texture;
  const size = useReportedSize(texture, atlas, slot.result);
  return { ...slot.result, texture, size };
}

/**
 * The size Godot reports for `texture`, which is `sheet`'s texture or the cell `atlas` cuts from
 * it. Kept while its width and height hold, so a consumer's memo on it holds too.
 */
function useReportedSize(
  texture: THREE.Texture | null,
  atlas: AtlasTextureReference | null,
  sheet: Texture2DResult
): ImageSize | undefined {
  const sheetSize = sheet.hasNoImage ? NO_AREA : imageSize(sheet.texture?.image);
  const size = texture && (atlas ? atlasTextureSize(atlas.texture, sheetSize ?? null) : sheetSize);
  const width = size?.width;
  const height = size?.height;
  return useMemo(
    () => (width === undefined || height === undefined ? undefined : { width, height }),
    [width, height]
  );
}

/** No `size`: a slot read by RID samples the texture and lays nothing out by it. */
export interface Texture2DRidResult extends Omit<Texture2DResult, 'size'> {
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
 * `isHeldLocally` is as `useTexture2D` names it: the mesh's and the material's for a material slot.
 */
export function useTexture2DRid(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  view: ViewportTextureView,
  isHeldLocally: boolean
): Texture2DRidResult {
  const { result, namesCanvasTexture } = useTexture2DSlot(
    ref,
    externalResources,
    internalResources,
    view,
    isHeldLocally
  );
  return namesCanvasTexture ? CANVAS_TEXTURE_RID : { ...result, namesTexture: true };
}

const NOTHING: Texture2DResult = { texture: null, missing: false, isArriving: false };

/** `ViewportTexture::get_size` while no viewport is set (`viewport.cpp:150-166`). */
const NO_AREA: ImageSize = { width: 0, height: 0 };

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
  isHeldLocally: boolean
): Texture2DSlot {
  // Wrappers peel before the atlas lookup: a CanvasTexture may wrap an AtlasTexture, and the raw
  // ref loses the window. A resource file may hold either, so its `[resource]` peels again.
  const outer = useMemo(() => peelCanvasTextures(ref, internalResources), [ref, internalResources]);
  const slot = useParsedResourceSlot(outer.ref, externalResources, internalResources);
  const inner = useMemo(
    () => peelCanvasTextures(slot.ref, slot.internalResources),
    [slot.ref, slot.internalResources]
  );
  const slotRef = inner.ref;
  // An AtlasTexture windows the sheet it names, an ordinary Texture2D slot with the same unwrap.
  const atlas = useMemo(
    () => resolveAtlasTextureRef(slotRef, slot.internalResources),
    [slotRef, slot.internalResources]
  );
  const sheet = useMemo(
    () => (atlas ? peelCanvasTextures(atlas.texture.atlas, slot.internalResources) : null),
    [atlas, slot.internalResources]
  );
  const sourceRef = sheet ? sheet.ref : slotRef;

  // A ViewportTexture names a node, not a file, so it comes from the live registry. The hook runs
  // for every slot, as the rules of hooks ask, and idles on an undefined reference.
  const isViewport = isViewportTextureRef(sourceRef, slot.internalResources);
  // Godot sets the ViewportTexture up only when every holder down to it is local to scene.
  const isFile = slot.internalResources !== internalResources;
  const isSetUp =
    isViewport &&
    isHeldLocally &&
    [
      ...outer.wrappers,
      isFile ? resolveSubResourceRef(slot.ref, slot.internalResources) : undefined,
      ...inner.wrappers,
      atlas ? findSubResource(slot.internalResources, atlas.id) : undefined,
      ...(sheet?.wrappers ?? []),
      resolveSubResourceRef(sourceRef, slot.internalResources),
    ].every((holder) => !holder || isLocalToScene(holder));
  const viewport = useViewportTextureSlot(isSetUp ? sourceRef : undefined, slot.internalResources, view);
  const unconfigured = isViewport && !isSetUp ? unconfiguredViewportTexture() : null;

  // Procedural first: the scene describes it, so no file round trip. A gradient resolves in the
  // same tick, a noise texture once its build lands. The procedural cache owns it, and this hook
  // pins it while mounted and never disposes it.
  const sources = useTextureSources(sourceRef, slot.externalResources, slot.internalResources);
  const procedural = useProceduralTexture(sources.readyRef, sources.pools, sources.loadedFile);

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
  const namesCanvasTexture = [outer, inner, sheet].some((layer) => (layer?.wrappers.length ?? 0) > 0);
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
  const sourceMissing =
    !procedural.claimed && !sources.isLoading && (!path || loaded.status === 'unavailable');
  const isArriving =
    sources.isLoading ||
    (procedural.claimed ? procedural.building : loaded.status === 'pending' && path !== null);
  return { ...peeled, result: { texture: source, missing: sourceMissing, isArriving } };
}
