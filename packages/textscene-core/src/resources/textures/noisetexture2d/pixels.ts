/**
 * NoiseTexture2D pixels: the bytes `NoiseTexture2D::_generate_texture` produces
 * (`modules/noise/noise_texture_2d.cpp:155-181`), in its order: noise image, then
 * color_ramp modulation, then bump-to-normal. It imports no THREE, so a worker
 * can run it and hand back only the buffer.
 */

import type { Gradient } from '../gradienttexture2d/types';
import type { FastNoiseLiteData } from '../../noise/fastnoiselite/types';
import type { NoiseTexture2DData } from './types';
import { grayToRgba, modulateWithGradient } from './gradientModulation';
import { noiseSampler } from './noiseGenerator';
import { noiseImage, seamlessNoiseImage } from './noiseImage';
import { bumpMapToNormalMap } from './normalMap';

/** Everything the pixels depend on, already decoded and resolved: a structured-clone value. */
export interface NoiseTexture2DInput {
  tex: NoiseTexture2DData;
  noise: FastNoiseLiteData;
  colorRamp: Gradient | null;
}

/**
 * The whole pipeline as bottom-up RGBA: `flipY` skips a typed-array source, and every
 * UV path assumes a file texture's flipY layout. A size the tab cannot allocate throws
 * `RangeError`, which the caller owns.
 */
export function noiseTexture2DPixels({ tex, noise, colorRamp }: NoiseTexture2DInput): Uint8Array {
  return bottomUp(rgbaPixels(tex, noise, colorRamp), tex.width, tex.height);
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
