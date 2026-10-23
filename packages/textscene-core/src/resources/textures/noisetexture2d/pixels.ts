/**
 * NoiseTexture2D levels: the bytes `NoiseTexture2D::_generate_texture` produces
 * (`modules/noise/noise_texture_2d.cpp:155-181`), in its order: noise image, then
 * color_ramp modulation, then bump-to-normal, then the mip chain. It imports no THREE, so a
 * worker can run it and hand back only the buffers.
 */

import type { Gradient } from '../gradienttexture2d/types';
import type { FastNoiseLiteData } from '../../noise/fastnoiselite/types';
import type { NoiseTexture2DData } from './types';
import { grayToRgba, modulateWithGradient } from '../../noise/image/gradientModulation';
import { noiseSampler } from '../../noise/image/noiseSampler';
import { noiseImage, seamlessNoiseImage } from '../../noise/image/noiseImage';
import { bumpMapToNormalMap } from './normalMap';
import { mipChain, type MipLevel } from '../../processing/mipChain';
import { reverseRowsInPlace } from '../../../utils/reversedRows';

/**
 * What the pixels depend on of the texture. `generate_mipmaps` is no input: the chain always
 * builds, and a texture that does not generate one drops it, so an edit to the flag samples no noise.
 */
export type NoiseTexture2DSampling = Omit<NoiseTexture2DData, 'generateMipmaps'>;

/** Everything the pixels depend on, already decoded and resolved: a structured-clone value. */
export interface NoiseTexture2DInput {
  tex: NoiseTexture2DSampling;
  noise: FastNoiseLiteData;
  colorRamp: Gradient | null;
}

/**
 * The whole pipeline as bottom-up RGBA levels, base first: `flipY` skips a typed-array source, and
 * every UV path assumes a file texture's flipY layout. The chain follows
 * (`noise_texture_2d.cpp:176-178`), built in Godot's top-down rows, since an odd size drops its
 * last row there. It is never renormalised: Godot calls `generate_mipmaps()` with no argument
 * (`image.h:340`). A size the tab cannot allocate throws `RangeError`, which the caller owns.
 */
export function noiseTexture2DLevels({ tex, noise, colorRamp }: NoiseTexture2DInput): MipLevel[] {
  const { width, height } = tex;
  const base = { data: rgbaPixels(tex, noise, colorRamp), width, height };
  const levels = mipChain(base, false);
  // In place, after the chain: the rows are top-down until it is built, and a second copy of
  // each level would raise the worker's peak memory from 1.33 to 2.67 times the base.
  // `rgbaPixels` returns a fresh array each call, so the shared base is safe to reverse.
  for (const level of levels) reverseRowsInPlace(level.data, level.width, level.height);
  return levels;
}

/** The noise image, then the colour ramp, then the bump-to-normal pass, as top-down RGBA. */
function rgbaPixels(
  tex: NoiseTexture2DSampling,
  noise: FastNoiseLiteData,
  colorRamp: Gradient | null
): Uint8Array {
  const { width, height } = tex;
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
