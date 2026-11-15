/**
 * The noise and the colour ramp a NoiseTexture2D or NoiseTexture3D names, read to the values its
 * build takes, so a worker job needs nothing but them. Each is a reference from any origin.
 */

import type { Follow } from '../reading';
import { FAST_NOISE_LITE } from '../noise/fastnoiselite/decode';
import type { FastNoiseLiteData } from '../noise/fastnoiselite/types';
import { GRADIENT } from './gradienttexture2d/decode';
import type { Gradient } from './gradienttexture2d/types';

export interface NoiseSources {
  readonly noise: FastNoiseLiteData;
  readonly colorRamp: Gradient | null;
}

/** The `noise` and `color_ramp` references of a noise texture. */
interface NoiseReferences {
  readonly noise: string | null;
  readonly colorRamp: string | null;
}

/** The `noise` and `color_ramp` references of a NoiseTexture2D or NoiseTexture3D's properties. */
export function noiseRefsOf(properties: Readonly<Record<string, string>>): NoiseReferences {
  return { noise: properties.noise ?? null, colorRamp: properties.color_ramp ?? null };
}

/**
 * Null for an unusable `noise`, for which `_generate_texture` returns no image
 * (`noise_texture_2d.cpp:159-161`, `noise_texture_3d.cpp:146-148`). Only FastNoiseLite generates.
 * Another Noise subclass would be its own kind behind the same `noise` slot.
 */
export function readNoiseSources(texture: NoiseReferences, follow: Follow): NoiseSources | null {
  // Both are read before either answer counts, so a ramp still loading holds the texture back.
  const noise = follow.read(FAST_NOISE_LITE, texture.noise ?? undefined);
  const colorRamp = follow.read(GRADIENT, texture.colorRamp ?? undefined);
  return noise.value && { noise: noise.value, colorRamp: colorRamp.value };
}
