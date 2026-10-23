/**
 * How a TextureRect or TextureButton samples its clone of the shared texture: the item's sampler and
 * the draw's UV window.
 */

import * as THREE from 'three';
import type { CloneSampler } from '../../../../r3f/drawnClone';
import {
  canvasItemCloneSampler,
  type CanvasItemTextureSampler,
} from '../../../../r3f/canvasItemTextureSampler';
import { textureRectUvWindow, type SampledDraw } from './nativeSolver';

/** The flip properties TextureRect and TextureButton share. */
interface Flip {
  flipH: boolean;
  flipV: boolean;
}

/** The sampler of a clone that draws `draw`, for `drawnClone`. */
export function rectTextureSampler(
  draw: SampledDraw,
  sampler: CanvasItemTextureSampler,
  { flipH, flipV }: Flip
): CloneSampler {
  const window = textureRectUvWindow(draw, flipH, flipV);
  // STRETCH_TILE forces repeat wrapping for this draw whatever the item's texture_repeat:
  // `draw_texture_rect(texture, rect, tile=true)` is a per-call override.
  const itemSampler = canvasItemCloneSampler(sampler);
  return draw.tile ? { ...itemSampler, wrap: THREE.RepeatWrapping, window } : { ...itemSampler, window };
}
