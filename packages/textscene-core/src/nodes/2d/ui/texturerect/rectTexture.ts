/**
 * How a TextureRect or TextureButton samples its view of the shared texture: the item's sampler and
 * the draw's UV window.
 */

import * as THREE from 'three';
import type { ViewSampler } from '../../../../resources/textures/textureView';
import type { Vector2 } from '../../../../godot/math/vector';
import { imageSize, type ImageSize } from '../../../../resources/formats/image/imagePixels';
import { textureRectUvWindow, type SampledDraw, type TextureRectDraw } from './nativeSolver';

/** The flip properties TextureRect and TextureButton share. */
interface Flip {
  flipH: boolean;
  flipV: boolean;
}

/**
 * The draw `layOut` places by `reported`, the size Godot reports for `texture`, sampled over its
 * real image: an unset ViewportTexture lays out at size 0 yet samples the placeholder. Null while
 * there is no image.
 */
export function sampledDraw(
  texture: THREE.Texture | null,
  reported: ImageSize | undefined,
  layOut: (reportedSize: Vector2) => TextureRectDraw
): SampledDraw | null {
  const sampled = imageSize(texture?.image);
  if (!sampled || !reported) return null;
  return {
    textureSize: { x: sampled.width, y: sampled.height },
    ...layOut({ x: reported.width, y: reported.height }),
  };
}

/** The sampler of a view that draws `draw`, from the item's own view sampler. */
export function rectTextureSampler(
  draw: SampledDraw,
  itemSampler: ViewSampler,
  { flipH, flipV }: Flip
): ViewSampler {
  const window = textureRectUvWindow(draw, flipH, flipV);
  // STRETCH_TILE forces repeat wrapping for this draw whatever the item's texture_repeat:
  // `draw_texture_rect(texture, rect, tile=true)` is a per-call override.
  return draw.tile ? { ...itemSampler, wrap: THREE.RepeatWrapping, window } : { ...itemSampler, window };
}
