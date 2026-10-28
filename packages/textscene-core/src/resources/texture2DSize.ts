/**
 * The size Godot reports for a Texture2D slot that the scene text states, for a Control's
 * minimum-size solve and a resource decode, which run outside React. The rule matches
 * `useTexture2D`'s: wrappers peel, an AtlasTexture reports its region, and a ViewportTexture its
 * viewport's size once Godot sets it up.
 */

import type { ParsedResource } from '../parser/parsedResource.js';
import type { TscnInternalResource } from '../parser/types.js';
import { peelCanvasTextures, resolveSubResourceRef } from './SubResourceResolver.js';
import { atlasTextureSize, decodeAtlasTexture } from './textures/atlastexture/decode.js';
import { decodeGradientTexture2D } from './textures/gradienttexture2d/decode.js';
import { imageRefSize } from './textures/image/decode.js';
import { decodeNoiseTexture2D } from './textures/noisetexture2d/decode.js';
import { parsedResourceTexture } from './textures/parsedResourceTexture.js';
import { isLocalToScene } from './textures/viewporttexture/localToScene.js';
import { VIEWPORT_TEXTURE_TYPE } from './textures/viewporttexture/types.js';

/** Pixel dimensions of a Texture2D slot, as the `Vector2` the rect solver uses. */
export interface Texture2DSize {
  x: number;
  y: number;
}

/** How a size read reaches a ViewportTexture. */
export interface ViewportTextureSizing {
  /** Whether every resource between the node and the slot is local to scene. */
  isHeldLocally: boolean;
  /** The size of the viewport a set-up ViewportTexture names, null while it is unknown. */
  viewportSize: (viewportTexture: TscnInternalResource) => Texture2DSize | null;
}

/** Sizing before Godot sets any ViewportTexture up, as a resource reads while its scene loads. */
export const BEFORE_SETUP: ViewportTextureSizing = { isHeldLocally: false, viewportSize: () => null };

/** `ViewportTexture::get_size` while no viewport is set (`viewport.cpp:150-166`). */
const NO_AREA: Texture2DSize = { x: 0, y: 0 };

/**
 * The pixel size of a Texture2D slot that the scene states. Null for a form only the loader can
 * size: an image, a wrapper of one, or a resource file (see `extResourceTexture2DSize`).
 */
export function inlineTexture2DSize(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  sizing: ViewportTextureSizing = BEFORE_SETUP
): Texture2DSize | null {
  // Unwrapped before the atlas lookup, as in the hook: the raw ref would answer the sheet's size.
  const peeled = peelCanvasTextures(ref, internalResources);
  const isHeldLocally = sizing.isHeldLocally && peeled.wrappers.every(isLocalToScene);
  const resource = resolveSubResourceRef(peeled.ref, internalResources);
  if (resource?.type !== 'AtlasTexture') return sheetSize(resource, internalResources, isHeldLocally, sizing);

  // Region plus margin, so a cell reserves the cell's size, and the sheet's on a zero axis.
  const atlas = decodeAtlasTexture(resource.data);
  const sheet = peelCanvasTextures(atlas.atlas, internalResources);
  const size = sheetSize(
    resolveSubResourceRef(sheet.ref, internalResources),
    internalResources,
    isHeldLocally && isLocalToScene(resource) && sheet.wrappers.every(isLocalToScene),
    sizing
  );
  const reported = atlasTextureSize(atlas, size && { width: size.x, height: size.y });
  return reported && { x: reported.width, y: reported.height };
}

/** The size of a texture that is no AtlasTexture, or null for one only the loader can size. */
function sheetSize(
  resource: TscnInternalResource | undefined,
  internalResources: readonly TscnInternalResource[],
  isHeldLocally: boolean,
  sizing: ViewportTextureSizing
): Texture2DSize | null {
  if (!resource) return null;
  if (resource.type === VIEWPORT_TEXTURE_TYPE) {
    return isHeldLocally && isLocalToScene(resource) ? sizing.viewportSize(resource) : NO_AREA;
  }
  // The declared size: neither getter consults the texture's source
  // (`scene/resources/gradient_texture.cpp`, `modules/noise/noise_texture_2d.cpp:378-384`), and
  // building one here mints a cache entry no consumer pins, open to eviction.
  const decode = DECLARED_SIZES[resource.type];
  if (decode) {
    const { width, height } = decode(resource.data);
    return { x: width, y: height };
  }
  // An ImageTexture's size is its image's (`scene/resources/image_texture.cpp:74-75`, `:122-128`).
  const image =
    resource.type === 'ImageTexture' ? imageRefSize(resource.data.image, internalResources) : null;
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
 * The pixel size of an `ExtResource` slot from its parsed resource file, for a caller with a
 * synchronous cache instead of hooks. Null for a file that holds no texture the scene could state inline.
 */
export function extResourceTexture2DSize(
  parsed: ParsedResource,
  sizing: ViewportTextureSizing = BEFORE_SETUP
): Texture2DSize | null {
  const saved = parsedResourceTexture(parsed);
  return inlineTexture2DSize(saved.ref, saved.internalResources, sizing);
}
