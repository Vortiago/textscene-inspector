/**
 * NoiseTexture3D texels: the bytes `NoiseTexture3D::_generate_texture` produces
 * (`modules/noise/noise_texture_3d.cpp:142-173`), in its order: noise volume, then color_ramp
 * modulation. It imports no THREE, so a worker can run it and hand back only the buffer.
 */

import type { FastNoiseLiteData } from '../../noise/fastnoiselite/types';
import type { Gradient } from '../gradienttexture2d/types';
import { modulateRedWithGradient } from '../../noise/image/gradientModulation';
import { noiseSampler3D } from '../../noise/image/noiseSampler';
import { noiseVolume, seamlessNoiseVolume } from '../../noise/image/noiseImage';
import type { NoiseTexture3DData } from './types';

/** Everything the texels depend on, already decoded and resolved: a structured-clone value. */
export interface NoiseTexture3DInput {
  tex: NoiseTexture3DData;
  noise: FastNoiseLiteData;
  colorRamp: Gradient | null;
}

/**
 * The red channel of each texel, slice after slice, each slice's rows from the top: the one
 * channel a fog density reads. Rows stay top-down, since Godot's first row is the texture's v = 0.
 * Seamless at depth 1, the volume holds two slices, as Godot's does.
 */
export function noiseTexture3DTexels({ tex, noise, colorRamp }: NoiseTexture3DInput): Uint8Array {
  // Domain warp is not applied, as for NoiseTexture2D (`fastnoise-lite.d.ts`).
  const sample = noiseSampler3D(noise);
  const { width, height, depth, invert, normalize } = tex;
  const gray = tex.seamless
    ? seamlessNoiseVolume(sample, width, height, depth, invert, normalize, tex.seamlessBlendSkirt)
    : noiseVolume(sample, width, height, depth, invert, normalize);
  return colorRamp ? modulateRedWithGradient(gray, colorRamp) : gray;
}
