/**
 * NoiseTexture2D build: the pixels `NoiseTexture2D::_generate_texture` produces
 * (`modules/noise/noise_texture_2d.cpp:155-181`), in its order: noise image, then
 * color_ramp modulation, then bump-to-normal. It composes the ported image layer
 * over `noiseGenerator`, the JS port of `thirdparty/misc/FastNoiseLite.h`.
 */

import * as THREE from 'three';
import type { Gradient } from '../gradienttexture2d/types';
import type { FastNoiseLiteData } from '../../noise/fastnoiselite/types';
import type { NoiseTexture2DData } from './types';
import { grayToRgba, modulateWithGradient } from './gradientModulation';
import { noiseSampler } from './noiseGenerator';
import { noiseImage, seamlessNoiseImage } from './noiseImage';
import { bumpMapToNormalMap } from './normalMap';

export { grayToRgba, modulateWithGradient } from './gradientModulation';
export { noiseSampler } from './noiseGenerator';
export type { NoiseSampler } from './noiseGenerator';
export { noiseImage, seamlessNoiseImage } from './noiseImage';
export { bumpMapToNormalMap } from './normalMap';

/**
 * The whole pipeline as a `THREE.DataTexture`, written bottom-up: `flipY` skips a
 * typed-array source, and every UV path assumes a file texture's flipY layout.
 */
export function rasterizeNoiseTexture2D(
  tex: NoiseTexture2DData,
  noise: FastNoiseLiteData,
  colorRamp: Gradient | null
): THREE.DataTexture {
  const width = Math.max(1, Math.trunc(tex.width));
  const height = Math.max(1, Math.trunc(tex.height));
  // Domain warp is not applied (`fastnoise_lite.cpp:318-325`): the JS port's
  // `DomainWrap` checks `instanceof Vector2` against a class it does not export,
  // so a plain `{x, y}` comes back unchanged (1.1.1). The field renders unwarped.
  const sample = noiseSampler(noise);

  const gray = tex.seamless
    ? seamlessNoiseImage(sample, width, height, tex.invert, tex.normalize, tex.seamlessBlendSkirt)
    : noiseImage(sample, width, height, tex.invert, tex.normalize);

  let rgba: Uint8Array;
  if (tex.asNormalMap) {
    // The bump conversion reads only the red channel, so the no-ramp path feeds
    // it the grayscale field directly instead of expanding to RGBA first.
    rgba = colorRamp
      ? bumpMapToNormalMap(modulateWithGradient(gray, colorRamp), 4, width, height, tex.bumpStrength)
      : bumpMapToNormalMap(gray, 1, width, height, tex.bumpStrength);
  } else {
    rgba = colorRamp ? modulateWithGradient(gray, colorRamp) : grayToRgba(gray);
  }

  const flipped = new Uint8Array(rgba.length);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    flipped.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), (height - 1 - y) * rowBytes);
  }

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
