/**
 * Resolves the emitter's raw `SubResource("id")` and `ExtResource("id")` strings against
 * `SceneResources` at render time: the parser sees a node's body, not the scene's resource table.
 * An ExtResource resolves once its file has loaded. Pure `.ts`, with only the shared decoders and no
 * THREE of its own.
 */

import { decodeCurveResource } from '../../../resources/curves/curve/decode';
import type { Curve } from '../../../resources/curves/curve/types';
import { referencedFilePath, resolveReference } from '../../../resources/resolveReference';
import type { LoadedFile } from '../../../resources/scopedResource';
import { decodeGradientResource } from '../../../resources/textures/gradienttexture2d/decode';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { CPU_PARTICLES_2D_PARAM_COUNT, type CPUParticles2DProperties } from './types';

type ParticleReferences = Pick<CPUParticles2DProperties, 'params' | 'color_ramp' | 'color_initial_ramp'>;

/** The `.tres` files the emitter's curves and ramps load from, each once. */
export function particleFiles(
  { params, color_ramp, color_initial_ramp }: ParticleReferences,
  pools: SceneResources
) {
  const references = [...params.map((param) => param.curve), color_ramp, color_initial_ramp];
  const paths = references.flatMap((ref) => referencedFilePath(ref, pools) ?? []);
  return [...new Set(paths)];
}

/**
 * One decoded `Curve` per parameter slot, `null` where the slot names none.
 * Always `CPU_PARTICLES_2D_PARAM_COUNT` long, so the simulation can index it
 * by `CPUParticles2DParam` without a bounds check.
 */
export function resolveParticleCurves(
  params: CPUParticles2DProperties['params'],
  pools: SceneResources,
  loadedFile: LoadedFile
): Array<Curve | null> {
  const curves: Array<Curve | null> = new Array(CPU_PARTICLES_2D_PARAM_COUNT).fill(null);
  for (let i = 0; i < CPU_PARTICLES_2D_PARAM_COUNT; i++) {
    curves[i] = decodeCurveResource(resolveReference(params[i]?.curve, pools, loadedFile)?.resource ?? null);
  }
  return curves;
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
  return decodeGradientResource(resolveReference(ref, pools, loadedFile)?.resource ?? null);
}
