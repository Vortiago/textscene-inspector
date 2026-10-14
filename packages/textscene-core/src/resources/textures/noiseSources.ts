/**
 * The noise and the colour ramp a NoiseTexture2D or NoiseTexture3D names, resolved to the values
 * its build reads, so a worker job needs nothing but them.
 */

import type { TscnInternalResource } from '../../parser/types';
import { findSubResource, parseResourceReference } from '../SubResourceResolver';
import { decodeFastNoiseLite } from '../noise/fastnoiselite/decode';
import type { FastNoiseLiteData } from '../noise/fastnoiselite/types';
import { resolveGradient } from './gradienttexture2d/decode';
import type { Gradient } from './gradienttexture2d/types';

export interface NoiseSources {
  noise: FastNoiseLiteData;
  colorRamp: Gradient | null;
}

/**
 * Null for an unusable `noise`, for which `_generate_texture` returns no image
 * (`noise_texture_2d.cpp:159-161`, `noise_texture_3d.cpp:146-148`). Only FastNoiseLite generates.
 * Another Noise subclass would be its own slice behind the same `noise` slot.
 */
export function resolveNoiseSources(
  refs: { noise: string | null; colorRamp: string | null },
  resources: readonly TscnInternalResource[]
): NoiseSources | null {
  const noiseResource = refs.noise
    ? findSubResource(resources, parseResourceReference(refs.noise)?.id ?? '')
    : undefined;
  if (!noiseResource || noiseResource.type !== 'FastNoiseLite') return null;
  return {
    noise: decodeFastNoiseLite(noiseResource.data),
    colorRamp: refs.colorRamp ? resolveGradient(refs.colorRamp, resources) : null,
  };
}
