/**
 * How a TextureRect or TextureButton samples its view of the shared texture: the item's sampler and
 * the draw's UV window.
 */

import * as THREE from 'three';
import type { ViewSampler } from '../../../../resources/textures/textureView';
import {
  canvasItemViewSampler,
  type CanvasItemTextureSampler,
} from '../../../../r3f/canvasItemTextureSampler';
import type { Vector2 } from '../../../../godot/math/vector';
import { imageSize } from '../../../../resources/formats/image/imagePixels';
import { textureSize } from '../../../../resources/textures/textureSize';
import { textureRectUvWindow, type SampledDraw, type TextureRectDraw } from './nativeSolver';

/** The flip properties TextureRect and TextureButton share. */
interface Flip {
  flipH: boolean;
  flipV: boolean;
}

/**
 * The draw `layOut` places by the size Godot reports for `texture`, sampled over its real image: an
 * unset ViewportTexture lays out at size 0 yet samples the placeholder. Null while there is no image.
 */
export function sampledDraw(
  texture: THREE.Texture | null,
  layOut: (reportedSize: Vector2) => TextureRectDraw
): SampledDraw | null {
  const sampled = imageSize(texture?.image);
  const reported = textureSize(texture);
  if (!sampled || !reported) return null;
  return {
    textureSize: { x: sampled.width, y: sampled.height },
    ...layOut({ x: reported.width, y: reported.height }),
  };
}

/** The sampler of a view that draws `draw`. */
export function rectTextureSampler(
  draw: SampledDraw,
  sampler: CanvasItemTextureSampler,
  { flipH, flipV }: Flip
): ViewSampler {
  const window = textureRectUvWindow(draw, flipH, flipV);
  // STRETCH_TILE forces repeat wrapping for this draw whatever the item's texture_repeat:
  // `draw_texture_rect(texture, rect, tile=true)` is a per-call override.
  const itemSampler = canvasItemViewSampler(sampler);
  return draw.tile ? { ...itemSampler, wrap: THREE.RepeatWrapping, window } : { ...itemSampler, window };
}
