/**
 * The texture a TextureRect or TextureButton draws: a clone of the shared texture with the item's
 * sampler and the draw's UV window. Every write is per-consumer state, and the resolved texture is a
 * cache entry other consumers read.
 */

import * as THREE from 'three';
import { undecodedClone } from '../../../../r3f/undecodedTexture';
import {
  applyCanvasItemSampler,
  type CanvasItemTextureSampler,
} from '../../../../r3f/canvasItemTextureSampler';
import { textureRectUvWindow, type SampledDraw } from './nativeSolver';

/** The flip properties TextureRect and TextureButton share. */
interface Flip {
  flipH: boolean;
  flipV: boolean;
}

/**
 * A clone of `texture` that draws `draw`. NoColorSpace, because the 2D canvas filters undecoded sRGB
 * bytes (`canvas2DTextureDecode.ts`) and `ControlQuad` decodes the filtered sample.
 */
export function rectTexture(
  texture: THREE.Texture,
  draw: SampledDraw,
  sampler: CanvasItemTextureSampler,
  { flipH, flipV }: Flip
): THREE.Texture {
  const cloned = undecodedClone(texture);
  applyCanvasItemSampler(cloned, sampler);
  // STRETCH_TILE forces repeat wrapping for this draw whatever the item's texture_repeat:
  // `draw_texture_rect(texture, rect, tile=true)` is a per-call override.
  if (draw.tile) cloned.wrapS = cloned.wrapT = THREE.RepeatWrapping;
  const { repeat, offset } = textureRectUvWindow(draw, flipH, flipV);
  cloned.repeat.set(repeat.x, repeat.y);
  cloned.offset.set(offset.x, offset.y);
  return cloned;
}
