/**
 * NoiseTexture2D build: the size ceilings, and the `THREE.DataTexture` around the
 * pixels `pixels.ts` computes.
 */

import * as THREE from 'three';
import { IMAGE_MAX_PIXELS } from '../../../godot/project/image.js';
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';
import type { NoiseTexture2DData } from './types';
import type { NoiseTexture2DInput } from './pixels';
import { seamlessSource } from '../../noise/image/noiseImage';
import { colourDataTexture } from '../colourDataTexture';
import { carryMipChain } from '../texelTexture';
import { godotTextureFilterState } from '../godotTextureFilter';
import type { MipLevel } from '../../processing/mipChain';

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
  return (
    seamlessSource(width, seamlessBlendSkirt) * seamlessSource(height, seamlessBlendSkirt) <= IMAGE_MAX_PIXELS
  );
}

/**
 * Bottom-up `levels`, computed from `input`, as the texture Godot builds from it. Several levels
 * are its mip chain, which the default sampler (`LINEAR_WITH_MIPMAPS`, `material.h:573`)
 * minifies between.
 */
export function noiseDataTexture(levels: MipLevel[], input: NoiseTexture2DInput): THREE.DataTexture {
  const { tex } = input;
  const texture = colourDataTexture(levels[0]!.data, tex.width, tex.height, imageFormat(input));
  // The producer sets the default sampler's minification itself: no material authored it yet.
  if (carryMipChain(texture, levels)) texture.minFilter = godotTextureFilterState(undefined).minFilter;
  // A normal map carries directions, not colour, so it starts raw, as its normal slot reads it.
  if (tex.asNormalMap) texture.colorSpace = THREE.NoColorSpace;
  // A seamless image tiles. A non-seamless one clamps like every other procedural texture.
  const wrap = tex.seamless ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  return texture;
}

/**
 * The format of Godot's image: L8 from the noise (`noise.cpp:134`, `:157`), RGBA8 once the colour
 * ramp (`noise_texture_2d.cpp:187`) or the bump pass (`image.cpp:4127`) rewrites it.
 */
function imageFormat({ tex, colorRamp }: NoiseTexture2DInput): string {
  return colorRamp || tex.asNormalMap ? 'RGBA8' : 'Lum8';
}
