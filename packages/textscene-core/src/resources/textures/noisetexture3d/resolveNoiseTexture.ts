/**
 * Resolves a `NoiseTexture3D` sub-resource to a texture that builds as a worker job, as
 * `resolveNoiseTexture2D` does for a NoiseTexture2D (ADR-0042).
 */

import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import type { LoadedFile } from '../../scopedResource';
import { noiseSourceResources, resolveNoiseSources } from '../noiseSources';
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
  pools: SceneResources,
  loadedFile: LoadedFile
): ProceduralTextureLookup | null {
  return resolveProceduralSubResourceAsync(
    ref,
    pools.internalResources,
    'NoiseTexture3D',
    (properties) => plan(properties, pools, loadedFile),
    (properties) => noiseSourceResources(decodeNoiseTexture3D(properties), pools, loadedFile)
  );
}

/**
 * Texture properties and the pools and files their `noise` and `color_ramp` refs resolve in, to a build.
 * Null for an unusable `noise`, for which `_generate_texture` returns no images
 * (`noise_texture_3d.cpp:146-148`), and for a size `noiseTexture3DFits` refuses.
 */
function plan(
  properties: Record<string, string>,
  pools: SceneResources,
  loadedFile: LoadedFile
): ProceduralBuildPlan<'noise-texture-3d'> | null {
  const decoded = decodeNoiseTexture3D(properties);
  const sources = resolveNoiseSources(decoded, pools, loadedFile);
  if (!sources || !noiseTexture3DFits(decoded)) return null;

  // The input carries the values the refs name, so a renamed id keeps the same content key.
  const input: NoiseTexture3DInput = { tex: { ...decoded, noise: null, colorRamp: null }, ...sources };
  return {
    job: 'noise-texture-3d',
    input,
    contentKey: `NoiseTexture3D:${JSON.stringify(input)}`,
    wrap: ({ texels }) => noiseDataTexture3D(texels, decoded),
  };
}
