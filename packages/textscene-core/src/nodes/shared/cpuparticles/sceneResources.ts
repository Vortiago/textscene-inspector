/**
 * Resolves an emitter's raw `SubResource("id")` and `ExtResource("id")` strings against
 * `SceneResources` at render time: the parser sees a node's body, not the scene's resource table.
 * An ExtResource resolves once its file has loaded. Pure `.ts`, with only the shared decoders and no
 * THREE of its own.
 */

import type { Curve } from '../../../resources/curves/curve/types';
import { resolveCurve } from '../../../resources/curves/curve/decode';
import type { LoadedFile } from '../../../resources/scopedResource';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { CPU_PARTICLES_PARAM_COUNT, type ParticleParam } from './params';

/** The `curve` reference of each parameter slot, always `CPU_PARTICLES_PARAM_COUNT` long. */
export function paramCurveReferences(params: readonly ParticleParam[]): Array<string | undefined> {
  return Array.from({ length: CPU_PARTICLES_PARAM_COUNT }, (_, slot) => params[slot]?.curve);
}

/**
 * One decoded `Curve` per parameter slot, `null` where the slot names none.
 * Always `CPU_PARTICLES_PARAM_COUNT` long, so the simulation can index it
 * by `CPUParticlesParameter` without a bounds check.
 */
export function resolveParticleCurves(
  params: readonly ParticleParam[],
  pools: SceneResources,
  loadedFile: LoadedFile
): Array<Curve | null> {
  return paramCurveReferences(params).map((ref) => resolveCurve(ref, pools, loadedFile));
}
