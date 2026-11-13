/**
 * Plans the build of a decoded `NoiseTexture2D` as a worker job: the job needs nothing but the
 * decoded values. A 1024x1024 seamless field takes about a second, which is why it runs off the
 * main thread (ADR-0042). `proceduralBuild` owns the build and the cache.
 */

import type * as THREE from 'three';
import { perObject } from '../../../utils/perObject';
import { proceduralBuild, type ProceduralBuildPlan, type ProceduralTextureLookup } from '../proceduralBuilds';
import type { NoiseTexture2DSource } from '../texture2d/types';
import { baseNoiseTexture, noiseDataTexture, noiseTextureFits } from './build';
import type { NoiseTexture2DInput } from './pixels';

/**
 * Planned once per decoded value: each consumer looks the texture up on every render, and a plan
 * serialises its input.
 */
const plannedBuild = perObject(plan);

export function noiseTexture2D(source: NoiseTexture2DSource): ProceduralTextureLookup | null {
  return proceduralBuild('NoiseTexture2D', plannedBuild(source));
}

/** Null for a size `noiseTextureFits` refuses. */
function plan({
  texture: decoded,
  sources,
}: NoiseTexture2DSource): ProceduralBuildPlan<'noise-texture-2d'> | null {
  if (!noiseTextureFits(decoded)) return null;

  // The input carries the values the refs name, so a renamed id keeps the same content key.
  const { generateMipmaps, ...tex } = decoded;
  const input: NoiseTexture2DInput = { tex: { ...tex, noise: null, colorRamp: null }, ...sources };
  return {
    job: 'noise-texture-2d',
    input,
    contentKey: `NoiseTexture2D:${JSON.stringify(input)}`,
    wrap: ({ levels }) => noiseDataTexture(levels, input),
    // The job always builds the chain, so toggling `generate_mipmaps` samples no noise again.
    derived: generateMipmaps
      ? undefined
      : {
          suffix: ':without-mipmaps',
          derive: (built) => baseNoiseTexture(built as THREE.DataTexture, input),
        },
  };
}
