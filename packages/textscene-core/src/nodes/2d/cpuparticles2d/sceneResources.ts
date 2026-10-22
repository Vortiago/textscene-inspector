/**
 * Resolves the emitter's raw `SubResource("id")` and `ExtResource("id")` strings against
 * `SceneResources` at render time: the parser sees a node's body, not the scene's resource table.
 * An ExtResource resolves once its file has loaded. Pure `.ts`, with only the shared decoders and no
 * THREE of its own.
 */

import { decodeCurveResource } from '../../../resources/curves/curve/decode';
import type { Curve } from '../../../resources/curves/curve/types';
import { referencedFilePath, resolveReferencedResource } from '../../../resources/resolveReference';
import type { LoadedFile } from '../../../resources/scopedResource';
import { decodeGradientResource } from '../../../resources/textures/gradienttexture2d/decode';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { CPU_PARTICLES_2D_PARAM_COUNT, type CPUParticles2DProperties } from './types';

type ParticleParams = CPUParticles2DProperties['params'];

/** The `curve` reference of each parameter slot, always `CPU_PARTICLES_2D_PARAM_COUNT` long. */
function curveReferences(params: ParticleParams): Array<string | undefined> {
  return Array.from({ length: CPU_PARTICLES_2D_PARAM_COUNT }, (_, slot) => params[slot]?.curve);
}

/** The `.tres` files the emitter's curves and ramps load from. */
export function particleFiles(
  {
    params,
    color_ramp,
    color_initial_ramp,
  }: Pick<CPUParticles2DProperties, 'params' | 'color_ramp' | 'color_initial_ramp'>,
  pools: SceneResources
): string[] {
  const references = [...curveReferences(params), color_ramp, color_initial_ramp];
  return references.flatMap((ref) => referencedFilePath(ref, pools) ?? []);
}

/**
 * One decoded `Curve` per parameter slot, `null` where the slot names none.
 * Always `CPU_PARTICLES_2D_PARAM_COUNT` long, so the simulation can index it
 * by `CPUParticles2DParam` without a bounds check.
 */
export function resolveParticleCurves(
  params: ParticleParams,
  pools: SceneResources,
  loadedFile: LoadedFile
): Array<Curve | null> {
  return curveReferences(params).map((ref) =>
    decodeCurveResource(resolveReferencedResource(ref, pools, loadedFile))
  );
}

/**
 * The `Gradient` a `color_ramp` / `color_initial_ramp` names, or null. The
 * gradient slice owns the type check.
 */
export function resolveParticleGradient(
  ref: string | undefined,
  pools: SceneResources,
  loadedFile: LoadedFile
): Gradient | null {
  return decodeGradientResource(resolveReferencedResource(ref, pools, loadedFile));
}
