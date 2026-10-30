/**
 * Resolves an emitter's raw `SubResource("id")` and `ExtResource("id")` strings against
 * `SceneResources` at render time: the parser sees a node's body, not the scene's resource table.
 * An ExtResource resolves once its file has loaded. Pure `.ts`, with only the shared decoders and no
 * THREE of its own.
 */

import { decodeCurveResource } from '../../../resources/curves/curve/decode';
import type { Curve } from '../../../resources/curves/curve/types';
import { referencedFilePath, resolveReferencedResource } from '../../../resources/resolveReference';
import type { LoadedFile } from '../../../resources/scopedResource';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { CPU_PARTICLES_PARAM_COUNT, type ParticleParam } from './params';

/** The `curve` reference of each parameter slot, always `CPU_PARTICLES_PARAM_COUNT` long. */
export function paramCurveReferences(params: readonly ParticleParam[]): Array<string | undefined> {
  return Array.from({ length: CPU_PARTICLES_PARAM_COUNT }, (_, slot) => params[slot]?.curve);
}

/** The `.tres` files the emitter's curve and ramp `references` load from. */
export function particleFiles(references: readonly (string | undefined)[], pools: SceneResources): string[] {
  return references.flatMap((ref) => referencedFilePath(ref, pools) ?? []);
}

/** The `Curve` a reference names, or null for none, a missing one and another type. */
export function resolveParticleCurve(
  ref: string | undefined,
  pools: SceneResources,
  loadedFile: LoadedFile
): Curve | null {
  return decodeCurveResource(resolveReferencedResource(ref, pools, loadedFile));
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
  return paramCurveReferences(params).map((ref) => resolveParticleCurve(ref, pools, loadedFile));
}
