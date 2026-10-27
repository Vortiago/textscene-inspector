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
import { textureRectUvWindow, type SampledDraw } from './nativeSolver';

/** The flip properties TextureRect and TextureButton share. */
interface Flip {
  flipH: boolean;
  flipV: boolean;
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
