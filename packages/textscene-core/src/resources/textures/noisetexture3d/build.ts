/**
 * NoiseTexture3D build: the size ceilings, and the `THREE.Data3DTexture` around the texels
 * `pixels.ts` computes.
 */

import * as THREE from 'three';
import { IMAGE_MAX_PIXELS } from '../../../godot/index.js';
import { MAX_3D_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';
import type { NoiseTexture3DData } from './types';

/**
 * Whether the previewer builds this texture. Godot refuses a volume past `Image::MAX_PIXELS`
 * (`noise_texture_3d.cpp:150`). The previewer also refuses an axis past the WebGL ceiling it
 * assumes (`MAX_3D_TEXTURE_EXTENT`), where Godot asks the device.
 */
export function noiseTexture3DFits({ width, height, depth }: NoiseTexture3DData): boolean {
  if (Math.max(width, height, depth) > MAX_3D_TEXTURE_EXTENT) return false;
  return width * height * depth <= IMAGE_MAX_PIXELS;
}

/**
 * The texels as a single-channel texture. Godot's fog shader samples a density texture linearly
 * and clamped (`environment/fog.cpp:259-260`), and as raw values, since its uniform has no
 * `source_color`. The depth comes from the texels: seamless at depth 1, Godot keeps two slices.
 */
export function noiseDataTexture3D(
  texels: Uint8Array,
  { width, height }: NoiseTexture3DData
): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(texels, width, height, texels.length / (width * height));
  texture.format = THREE.RedFormat;
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
