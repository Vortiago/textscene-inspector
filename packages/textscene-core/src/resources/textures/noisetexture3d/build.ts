/**
 * NoiseTexture3D build: the size ceilings, and the `THREE.Data3DTexture` around the texels
 * `texels.ts` computes.
 */

import * as THREE from 'three';
import { IMAGE_MAX_PIXELS } from '../../../godot/index.js';
import { MAX_3D_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';
import { dataTexture3D } from '../dataTexture3D';
import type { NoiseTexture3DData } from './types';

/**
 * Whether the previewer builds this texture. Godot refuses a volume past `Image::MAX_PIXELS`
 * (`noise_texture_3d.cpp:150`). The previewer also refuses an axis past the WebGL ceiling it
 * assumes (`MAX_3D_TEXTURE_EXTENT`), where Godot asks the device. Under that ceiling a seamless
 * source slice stays far below `Image::MAX_PIXELS` (`noise.cpp:43`), so it needs no check.
 */
export function noiseTexture3DFits({ width, height, depth }: NoiseTexture3DData): boolean {
  if (Math.max(width, height, depth) > MAX_3D_TEXTURE_EXTENT) return false;
  return width * height * depth <= IMAGE_MAX_PIXELS;
}

/** The texels as a single-channel texture. Seamless at depth 1, Godot keeps two slices. */
export function noiseDataTexture3D(
  texels: Uint8Array,
  { width, height }: NoiseTexture3DData
): THREE.Data3DTexture {
  return dataTexture3D(texels, width, height, texels.length / (width * height), THREE.RedFormat);
}
