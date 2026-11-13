/**
 * Plans the build of a decoded `NoiseTexture3D` as a worker job, as `noiseTexture2D` does for a
 * NoiseTexture2D (ADR-0042).
 */

import { perObject } from '../../../utils/perObject';
import { proceduralBuild, type ProceduralBuildPlan, type ProceduralTextureLookup } from '../proceduralBuilds';
import type { NoiseTexture3DSource } from '../texture3d/types';
import { noiseDataTexture3D, noiseTexture3DFits } from './build';
import type { NoiseTexture3DInput } from './texels';

/**
 * Planned once per decoded value: each consumer looks the texture up on every render, and a plan
 * serialises its input.
 */
const plannedBuild = perObject(plan);

export function noiseTexture3D(source: NoiseTexture3DSource): ProceduralTextureLookup | null {
  return proceduralBuild('NoiseTexture3D', plannedBuild(source));
}

/** Null for a size `noiseTexture3DFits` refuses. */
function plan({
  texture: decoded,
  sources,
}: NoiseTexture3DSource): ProceduralBuildPlan<'noise-texture-3d'> | null {
  if (!noiseTexture3DFits(decoded)) return null;
  // The input carries the values the refs name, so a renamed id keeps the same content key.
  const input: NoiseTexture3DInput = { tex: { ...decoded, noise: null, colorRamp: null }, ...sources };
  return {
    job: 'noise-texture-3d',
    input,
    contentKey: `NoiseTexture3D:${JSON.stringify(input)}`,
    wrap: ({ texels }) => noiseDataTexture3D(texels, decoded),
  };
}
