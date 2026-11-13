/**
 * The one resolver for a Texture2D slot: an image file, a `CanvasTexture`, an `AtlasTexture`,
 * `GradientTexture2D`, `NoiseTexture2D` or `ImageTexture`, each inline or saved as its own resource
 * file at any position of the chain, or a `ViewportTexture`'s live target. The `TEXTURE_2D` kind
 * reads the chain, and this builds the GPU texture from the decoded value. The texture's size is
 * Godot's size for the slot. `inlineTexture2DSize` sizes a slot outside React by the same rule.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { useReferencedResource, type ScopedReference } from './reading';
import { texture2DPlaceholder } from './textures/texture2DPlaceholder';
import {
  atlasCellRect,
  atlasRegionInCell,
  atlasTextureLayout,
  atlasTextureSize,
} from './textures/atlastexture/decode';
import type { AtlasTextureData } from './textures/atlastexture/types';
import type { Rect2 } from '../godot/math/rect2';
import { imageSize, type ImageSize } from './formats/image/imagePixels';
import {
  useViewportTextureSlot,
  type ViewportTextureView,
} from './textures/viewporttexture/useViewportTextureSlot';
import { useProceduralTexture } from './useProceduralTexture';
import { useAtlasTextureCrop } from './useAtlasTextureCrop';
import { useResource } from './useResource';
import { TEXTURE_2D } from './textures/texture2d/kind';
import { peelTexture2D } from './textures/texture2d/peel';
import type { CanvasTextureMaps } from './textures/texture2d/types';
import { proceduralTexture2D } from './textures/resolveProceduralTexture';
import { useByValue } from '../r3f/hooks/useByValue';
import { sameData } from '../utils/sameData';
import { useCanvasColorSpace } from '../r3f/canvasColorSpace';

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
   * The size Godot reports for the texture: its image's, an AtlasTexture's region's, 0 by 0 for
   * a ViewportTexture its scene never sets up (`viewport.cpp:150-166`), or the `width` and `height`
   * of a GradientTexture2D with no gradient (`gradient_texture.cpp:400`). Both sample the placeholder.
   * Undefined while there is no texture.
   */
  size?: ImageSize;
  /**
   * Set when the slot reaches a texture whose `get_image()` is null, through any wrapper: a
   * ViewportTexture Godot never sets up (`viewport.cpp:180-186`) or a GradientTexture2D with no
   * gradient (`gradient_texture.cpp:229-233`). `texture` then samples the placeholder.
   */
  hasNoImage?: true;
  /** The CanvasTexture the slot names, directly or in its resource file. */
  canvasTexture?: CanvasTextureSlot;
  /** For an AtlasTexture, where `texture`, the cut cell, lies in its atlas. */
  atlasCell?: AtlasCell;
}

/**
 * A cut cell in its atlas, for a reader that draws as Godot's 3D sprite does: the region alone,
 * sampled from the atlas with the UVs of the atlas (`sprite_3d.cpp:100-150`).
 */
export interface AtlasCell extends AtlasCellRects {
  /** The atlas itself, uncut. */
  sheet: THREE.Texture;
}

interface AtlasCellRects {
  sheetSize: ImageSize;
  /** The cell in atlas pixels, margin and all. It can reach past the atlas. */
  cell: Rect2;
  /** The rectangle of the cell, in its pixels, that the region fills. */
  region: Rect2;
}

/** A CanvasTexture's maps, which a canvas item lights through. */
export interface CanvasTextureSlot extends CanvasTextureMaps {
  /** The AtlasTexture that draws a cell of this CanvasTexture, which cuts its maps alike. */
  atlas?: CanvasTextureAtlas;
}

/** An AtlasTexture whose atlas is a CanvasTexture, and the size of the diffuse sheet it cuts. */
export interface CanvasTextureAtlas {
  texture: AtlasTextureData;
  sheetSize: ImageSize;
}

/**
 * The texture `reference` names. `view` is the ViewportTexture view the slot samples, and a canvas
 * item's colour slot omits it to sample the view of its canvas's colour space. Null names nothing.
 */
export function useTexture2D(reference: ScopedReference | null, view?: ViewportTextureView): Texture2DResult {
  const canvasView = useCanvasColorSpace().viewportTextureView;
  const slot = useTexture2DSlot(reference, view ?? canvasView);
  const { atlas, source } = slot;
  const cropped = useAtlasTextureCrop(atlas, source);
  // A sheet still loading, or a zero-area region that Godot's `get_rect_region` also declines,
  // draws nothing and is no resource error.
  const texture = atlas ? cropped : slot.result.texture;
  const size = useReportedSize(texture, atlas, slot.result);
  const sheet = slot.result.texture;
  const cellRects = useByValue(texture && atlas ? atlasCellRects(atlas, sheet) : undefined, sameData);
  const atlasCell = useMemo(() => sheet && cellRects && { ...cellRects, sheet }, [sheet, cellRects]);
  return {
    ...slot.result,
    texture,
    size,
    canvasTexture: slot.canvasTexture,
    ...(atlasCell && { atlasCell }),
  };
}

/** Where the cell `atlas` cuts lies in `sheet`'s image. Undefined for a cell that draws nothing. */
function atlasCellRects(
  atlas: AtlasTextureData,
  sheet: THREE.Texture | null | undefined
): AtlasCellRects | undefined {
  const sheetSize = imageSize(sheet?.image);
  const layout = sheetSize && atlasTextureLayout(atlas, sheetSize);
  if (!layout) return undefined;
  return { sheetSize, cell: atlasCellRect(layout), region: atlasRegionInCell(layout) };
}

/**
 * The size Godot reports for `texture`, which is `sheet`'s texture or the cell `atlas` cuts from
 * it. Kept while its width and height hold, so a consumer's memo on it holds too.
 */
function useReportedSize(
  texture: THREE.Texture | null,
  atlas: AtlasTextureData | null,
  sheet: Texture2DResult
): ImageSize | undefined {
  const sheetSize = sheet.hasNoImage ? sheet.size : imageSize(sheet.texture?.image);
  const size = texture && (atlas ? atlasTextureSize(atlas, sheetSize ?? null) : sheetSize);
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
 */
export function useTexture2DRid(
  reference: ScopedReference | null,
  view: ViewportTextureView
): Texture2DRidResult {
  const { result, namesCanvasTexture } = useTexture2DSlot(reference, view);
  return namesCanvasTexture ? CANVAS_TEXTURE_RID : { ...result, namesTexture: true };
}

const NOTHING: Texture2DResult = { texture: null, missing: false, isArriving: false };

/** `ViewportTexture::get_size` while no viewport is set (`viewport.cpp:150-166`). */
const NO_AREA: ImageSize = { width: 0, height: 0 };

const CANVAS_TEXTURE_RID: Texture2DRidResult = { ...NOTHING, namesTexture: false };

interface Texture2DSlot {
  /** The AtlasTexture the slot names, or null for any other form. */
  atlas: AtlasTextureData | null;
  /** The image or procedural texture behind the slot: an AtlasTexture's sheet. */
  source: THREE.Texture | null;
  /** The slot's result with an AtlasTexture's sheet in its place. */
  result: Texture2DResult;
  /** The slot, its resource file or its AtlasTexture's sheet is a CanvasTexture. */
  namesCanvasTexture: boolean;
  /**
   * The CanvasTexture the slot or its AtlasTexture's atlas names, which the AtlasTexture draws
   * through (`atlas_texture.cpp:189`). Godot refuses to nest one (`canvas_item.cpp:1787`), so
   * there is at most one.
   */
  canvasTexture: CanvasTextureSlot | undefined;
}

/** The CanvasTexture an AtlasTexture's atlas names, once its diffuse sheet has a size. */
function atlasCanvasTexture(
  maps: CanvasTextureMaps | null,
  atlas: AtlasTextureData | null,
  sheetSize: ImageSize | undefined
): CanvasTextureSlot | undefined {
  if (!maps || !atlas || !sheetSize) return undefined;
  return { ...maps, atlas: { texture: atlas, sheetSize } };
}

function useTexture2DSlot(reference: ScopedReference | null, view: ViewportTextureView): Texture2DSlot {
  const read = useReferencedResource(reference, TEXTURE_2D);
  const peeled = useMemo(() => peelTexture2D(read), [read]);
  const { atlas, source: decoded } = peeled;

  // A ViewportTexture names a node, not a file, so it comes from the live registry. The hook runs
  // for every slot, as the rules of hooks ask, and idles on a null path.
  const isViewport = decoded?.form === 'viewport';
  const isSetUp = isViewport && decoded.isSetUp;
  const viewport = useViewportTextureSlot(isSetUp ? decoded.viewportPath : null, view);
  const gradientSize = decoded?.form === 'gradient' && !decoded.gradient ? decoded.texture : null;
  const hasNoImage = (isViewport && !isSetUp) || gradientSize !== null;
  const unconfigured = hasNoImage ? texture2DPlaceholder() : null;

  // Procedural first: the resource describes it, so no file round trip. A gradient resolves in the
  // same tick, a noise texture once its build lands. The procedural cache owns it, and this hook
  // pins it while mounted and never disposes it.
  const lookup = useMemo(() => proceduralTexture2D(decoded), [decoded]);
  const procedural = useProceduralTexture(lookup);

  const path = decoded?.form === 'file' ? decoded.path : null;
  const loaded = useResource<THREE.Texture>(path ?? '', 'texture');
  const source = unconfigured ?? viewport.texture ?? procedural.texture ?? loaded.value ?? null;
  // By value: `imageSize` builds a new object on every render.
  const sheetSize = useByValue(imageSize(source?.image), sameData);
  const canvasTexture = useMemo(
    () => peeled.canvasTexture ?? atlasCanvasTexture(peeled.sheetCanvasTexture, atlas, sheetSize),
    [peeled, atlas, sheetSize]
  );
  const slot = { atlas, source, namesCanvasTexture: peeled.namesCanvasTexture, canvasTexture };

  if (peeled.status !== 'loaded') {
    const result = {
      texture: null,
      missing: peeled.status === 'missing',
      isArriving: peeled.status === 'pending',
    };
    return { ...slot, result };
  }

  // A target arrives after first paint and is no file on its way, so only a cycle stops it.
  if (unconfigured)
    return {
      ...slot,
      result: {
        texture: source,
        missing: false,
        isArriving: false,
        hasNoImage: true,
        size: gradientSize ? { width: gradientSize.width, height: gradientSize.height } : NO_AREA,
      },
    };
  if (isViewport)
    return { ...slot, result: { texture: source, missing: viewport.cyclic, isArriving: false } };
  const sourceMissing = !procedural.claimed && (!path || loaded.status === 'unavailable');
  const isArriving = procedural.claimed ? procedural.building : loaded.status === 'pending' && path !== null;
  return { ...slot, result: { texture: source, missing: sourceMissing, isArriving } };
}
