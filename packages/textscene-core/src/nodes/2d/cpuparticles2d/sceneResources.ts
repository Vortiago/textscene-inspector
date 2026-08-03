/**
 * Turn the emitter's raw `SubResource("id")` property strings into the decoded
 * resources the simulation consumes.
 *
 * The parser sees property strings only — it is handed a node's body, not the
 * scene's resource table — so every Curve/Gradient slot is carried as a raw
 * reference and resolved here, at render time, against `SceneResources`.
 *
 * Pure `.ts`: only the shared decoders, no THREE of its own.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { resolveCurve } from '../../../resources/curves/curve/decode';
import type { Curve } from '../../../resources/curves/curve/types';
import { resolveGradient } from '../../../resources/textures/gradienttexture2d/decode';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import { CPU_PARTICLES_2D_PARAM_COUNT, type ParticleParam } from './types';

/**
 * One decoded `Curve` per parameter slot, `null` where the slot names none.
 * Always `CPU_PARTICLES_2D_PARAM_COUNT` long, so the simulation can index it
 * by `CPUParticles2DParam` without a bounds check.
 */
export function resolveParticleCurves(
  params: readonly ParticleParam[],
  internalResources: readonly TscnInternalResource[]
): Array<Curve | null> {
  const curves: Array<Curve | null> = new Array(CPU_PARTICLES_2D_PARAM_COUNT).fill(null);
  for (let i = 0; i < CPU_PARTICLES_2D_PARAM_COUNT; i++) {
    curves[i] = resolveCurve(params[i]?.curve, internalResources);
  }
  return curves;
}

/**
 * The `Gradient` a `color_ramp` / `color_initial_ramp` names, or null. Named for
 * the emitter's slots so the simulation reads in its own vocabulary; the
 * reference form and the type check belong to the gradient slice.
 */
export function resolveParticleGradient(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): Gradient | null {
  return resolveGradient(ref, internalResources);
}
