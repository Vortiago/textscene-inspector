/**
 * NoiseTexture2D build: the size ceilings, and the `THREE.DataTexture` around the
 * pixels `pixels.ts` computes over `noiseGenerator`, the JS port of
 * `thirdparty/misc/FastNoiseLite.h`.
 */

import * as THREE from 'three';
import { IMAGE_MAX_PIXELS } from '../../../godot/index.js';
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';
import type { NoiseTexture2DData } from './types';
import { seamlessSkirt } from './noiseImage';

export { grayToRgba, modulateWithGradient } from './gradientModulation';
export { noiseSampler } from './noiseGenerator';
export type { NoiseSampler } from './noiseGenerator';
export { noiseImage, seamlessNoiseImage, seamlessSkirt } from './noiseImage';
export { bumpMapToNormalMap } from './normalMap';

/**
 * Whether the previewer rasterises this texture. It refuses an axis past the WebGL ceiling it
 * assumes (`MAX_TEXTURE_EXTENT`), where Godot asks the device. Separately, Godot never builds a
 * seamless source past `Image::MAX_PIXELS` (`noise.cpp:43`, `image.cpp:2421`).
 */
export function noiseTextureFits({
  width,
  height,
  seamless,
  seamlessBlendSkirt,
}: NoiseTexture2DData): boolean {
  if (width > MAX_TEXTURE_EXTENT || height > MAX_TEXTURE_EXTENT) return false;
  if (!seamless) return true;
  const sourceWidth = width + seamlessSkirt(width, seamlessBlendSkirt);
  const sourceHeight = height + seamlessSkirt(height, seamlessBlendSkirt);
  return sourceWidth * sourceHeight <= IMAGE_MAX_PIXELS;
}

/** Bottom-up `pixels` as the texture Godot's import flags describe for `tex`. */
export function noiseDataTexture(pixels: Uint8Array, tex: NoiseTexture2DData): THREE.DataTexture {
  const texture = new THREE.DataTexture(pixels, tex.width, tex.height, THREE.RGBAFormat);
  // A normal map carries directions, not colour, and sRGB would bend every normal.
  // Godot marks the same distinction with its `srgb` import flag.
  texture.colorSpace = tex.asNormalMap ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  // A seamless image tiles. A non-seamless one clamps like every other procedural texture.
  const wrap = tex.seamless ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.needsUpdate = true;
  return texture;
}
