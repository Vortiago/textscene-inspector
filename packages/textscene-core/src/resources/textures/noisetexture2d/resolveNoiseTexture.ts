/**
 * Resolves a `NoiseTexture2D` sub-resource to a texture that builds as a worker
 * job: its own file describes it fully, so the job needs nothing but the decoded
 * values. A 1024x1024 seamless field takes about a second, which is why it runs
 * off the main thread (ADR-0042). `resolveProceduralSubResourceAsync` owns the
 * walk, the build and the cache.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { resolveNoiseSources } from '../noiseSources';
import {
  resolveProceduralSubResourceAsync,
  type ProceduralBuildPlan,
  type ProceduralTextureLookup,
} from '../proceduralBuilds';
import { noiseDataTexture, noiseTextureFits } from './build';
import { decodeNoiseTexture2D } from './decode';
import type { NoiseTexture2DInput } from './pixels';

export function resolveNoiseTexture2D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureLookup | null {
  return resolveProceduralSubResourceAsync(ref, internalResources, 'NoiseTexture2D', plan);
}

/**
 * Texture properties and the table their `noise` and `color_ramp` refs resolve in,
 * to a build. Null for an unusable `noise`, for which `_generate_texture` returns an
 * empty image (noise_texture_2d.cpp:159-161), and for a size `noiseTextureFits` refuses.
 */
function plan(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): ProceduralBuildPlan<'noise-texture-2d'> | null {
  const decoded = decodeNoiseTexture2D(properties);
  const sources = resolveNoiseSources(decoded, resources);
  if (!sources || !noiseTextureFits(decoded)) return null;

  // The input carries the values the refs name, so a renamed id keeps the same content key.
  const input: NoiseTexture2DInput = { tex: { ...decoded, noise: null, colorRamp: null }, ...sources };
  return {
    job: 'noise-texture-2d',
    input,
    contentKey: `NoiseTexture2D:${JSON.stringify(input)}`,
    wrap: ({ pixels }) => noiseDataTexture(pixels, decoded),
  };
}
