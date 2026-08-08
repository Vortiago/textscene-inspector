/**
 * NoiseTexture2D build — decoded settings plus a resolved gradient into the
 * pixels Godot's `NoiseTexture2D::_generate_texture` produces
 * (`modules/noise/noise_texture_2d.cpp:155-181`), in its order:
 *
 *   noise image (seamless or plain) → color_ramp modulation → bump-to-normal
 *
 * The generator itself is NOT hand-ported: `fastnoise-lite` is the official JS
 * port of the same upstream library Godot vendors as
 * `thirdparty/misc/FastNoiseLite.h`, so the same settings and seed produce the
 * same field. Only the IMAGE layer around it is ported here, because that layer
 * is Godot's own (normalization, the seamless blend skirt, the bump-map
 * conversion), and each piece cites the line it comes from. Those pieces live
 * beside this file — `noiseGenerator`, `noiseImage`, `gradientModulation`,
 * `normalMap` — and this one composes them into the texture.
 *
 * DOMAIN WARP IS NOT APPLIED. Godot warps the sample position through a second
 * generator (`fastnoise_lite.cpp:318-325`), but the JS port's entry point —
 * spelled `DomainWrap` — dispatches on `arguments[0] instanceof Vector2` against
 * a class it does not export, so a caller outside the module cannot drive it
 * (verified against 1.1.1: a plain `{x, y}` comes back unchanged). Eleven corpus
 * resources set `domain_warp_enabled`; they render their unwarped field, which
 * is the same generator with straight coordinates. Recorded in
 * `resources/textures/comparison.md`.
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
 * The whole pipeline as a `THREE.DataTexture`.
 *
 * Rows are written BOTTOM-UP for the same reason the GradientTexture2D
 * rasteriser does it: `flipY` does not apply to a typed-array source, and every
 * UV path in the repo is written for the flipY convention a file-backed texture
 * gets, so Godot's top row has to land last in the buffer.
 */
export function rasterizeNoiseTexture2D(
  tex: NoiseTexture2DData,
  noise: FastNoiseLiteData,
  colorRamp: Gradient | null
): THREE.DataTexture {
  const width = Math.max(1, Math.trunc(tex.width));
  const height = Math.max(1, Math.trunc(tex.height));
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
  // A normal map carries directions, not colour: sampling it through sRGB would
  // bend every normal. Godot marks the same distinction with its `srgb` import
  // flag; here the two arrival paths differ only in this one field.
  texture.colorSpace = tex.asNormalMap ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  // Godot's seamless image exists to be tiled; a non-seamless one is clamped
  // like every other procedural texture here.
  const wrap = tex.seamless ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.needsUpdate = true;
  return texture;
}
