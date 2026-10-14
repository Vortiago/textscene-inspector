/**
 * Resolves a `NoiseTexture3D` sub-resource to a texture that builds as a worker job, as
 * `resolveNoiseTexture2D` does for a NoiseTexture2D (ADR-0042).
 */

import type { TscnInternalResource } from '../../../parser/types';
import { findSubResource, parseResourceReference } from '../../SubResourceResolver';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';
import { resolveGradient } from '../gradienttexture2d/decode';
import {
  resolveProceduralSubResourceAsync,
  type ProceduralBuildPlan,
  type ProceduralTextureLookup,
} from '../proceduralBuilds';
import { noiseDataTexture3D, noiseTexture3DFits } from './build';
import { decodeNoiseTexture3D } from './decode';
import type { NoiseTexture3DInput } from './texels';

export function resolveNoiseTexture3D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureLookup | null {
  return resolveProceduralSubResourceAsync(ref, internalResources, 'NoiseTexture3D', plan);
}

/**
 * Texture properties and the table their `noise` and `color_ramp` refs resolve in, to a build.
 * Null for an unusable `noise`, for which `_generate_texture` returns no images
 * (`noise_texture_3d.cpp:146-148`), and for a size `noiseTexture3DFits` refuses.
 */
function plan(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): ProceduralBuildPlan<'noise-texture-3d'> | null {
  const decoded = decodeNoiseTexture3D(properties);
  const noiseResource = decoded.noise
    ? findSubResource(resources, parseResourceReference(decoded.noise)?.id ?? '')
    : undefined;
  // Only FastNoiseLite generates, as for NoiseTexture2D.
  if (!noiseResource || noiseResource.type !== 'FastNoiseLite') return null;
  if (!noiseTexture3DFits(decoded)) return null;

  // The input carries the values the refs name, so a renamed id keeps the same content key.
  const input: NoiseTexture3DInput = {
    tex: { ...decoded, noise: null, colorRamp: null },
    noise: decodeFastNoiseLite(noiseResource.data),
    colorRamp: decoded.colorRamp ? resolveGradient(decoded.colorRamp, resources) : null,
  };
  return {
    job: 'noise-texture-3d',
    input,
    contentKey: `NoiseTexture3D:${JSON.stringify(input)}`,
    wrap: ({ texels }) => noiseDataTexture3D(texels, decoded),
  };
}
