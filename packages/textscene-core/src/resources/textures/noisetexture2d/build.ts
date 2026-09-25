/**
 * NoiseTexture2D build: the pixels `NoiseTexture2D::_generate_texture` produces
 * (`modules/noise/noise_texture_2d.cpp:155-181`), in its order: noise image, then
 * color_ramp modulation, then bump-to-normal. It composes the ported image layer
 * over `noiseGenerator`, the JS port of `thirdparty/misc/FastNoiseLite.h`.
 */

import * as THREE from 'three';
import { IMAGE_MAX_PIXELS } from '../../../godot/index.js';
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';
import { unlessAllocationFails } from '../pixelAllocation';
import type { Gradient } from '../gradienttexture2d/types';
import type { FastNoiseLiteData } from '../../noise/fastnoiselite/types';
import type { NoiseTexture2DData } from './types';
import { grayToRgba, modulateWithGradient } from './gradientModulation';
import { noiseSampler } from './noiseGenerator';
import { noiseImage, seamlessNoiseImage, seamlessSkirt } from './noiseImage';
import { bumpMapToNormalMap } from './normalMap';

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

/**
 * The whole pipeline as a `THREE.DataTexture`, written bottom-up: `flipY` skips a
 * typed-array source, and every UV path assumes a file texture's flipY layout. Null
 * for a size {@link noiseTextureFits} refuses, or one the tab cannot allocate, so the
 * previewer draws no texture.
 */
export function rasterizeNoiseTexture2D(
  tex: NoiseTexture2DData,
  noise: FastNoiseLiteData,
  colorRamp: Gradient | null
): THREE.DataTexture | null {
  if (!noiseTextureFits(tex)) return null;
  const { width, height } = tex;
  const flipped = unlessAllocationFails(`[NoiseTexture2D] ${width}x${height}`, () =>
    bottomUp(rgbaPixels(tex, noise, colorRamp), width, height)
  );
  if (flipped === null) return null;

  const texture = new THREE.DataTexture(flipped, width, height, THREE.RGBAFormat);
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

/** The noise image, then the colour ramp, then the bump-to-normal pass, as top-down RGBA. */
function rgbaPixels(
  tex: NoiseTexture2DData,
  noise: FastNoiseLiteData,
  colorRamp: Gradient | null
): Uint8Array {
  const { width, height } = tex;
  // Domain warp is not applied (`fastnoise_lite.cpp:318-325`): the JS port's
  // `DomainWrap` checks `instanceof Vector2` against a class it does not export,
  // so a plain `{x, y}` comes back unchanged (1.1.1). The field renders unwarped.
  const sample = noiseSampler(noise);

  const gray = tex.seamless
    ? seamlessNoiseImage(sample, width, height, tex.invert, tex.normalize, tex.seamlessBlendSkirt)
    : noiseImage(sample, width, height, tex.invert, tex.normalize);

  if (tex.asNormalMap) {
    // The bump conversion reads only the red channel, so the no-ramp path feeds
    // it the grayscale field directly instead of expanding to RGBA first.
    return colorRamp
      ? bumpMapToNormalMap(modulateWithGradient(gray, colorRamp), 4, width, height, tex.bumpStrength)
      : bumpMapToNormalMap(gray, 1, width, height, tex.bumpStrength);
  }
  return colorRamp ? modulateWithGradient(gray, colorRamp) : grayToRgba(gray);
}

/** `rgba`'s rows in reverse order, the layout a typed-array `DataTexture` needs. */
function bottomUp(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const flipped = new Uint8Array(rgba.length);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    flipped.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), (height - 1 - y) * rowBytes);
  }
  return flipped;
}
