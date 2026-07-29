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
import { resolveSubResourceRef } from '../../../resources/SubResourceResolver';
import { resolveCurve } from '../../../resources/curve/parser';
import type { Curve } from '../../../resources/curve/types';
import { parseGradient } from '../../../resources/textures/gradienttexture2d/parser';
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
 * The `Gradient` a `color_ramp` / `color_initial_ramp` names, or null. Godot's
 * CPUParticles2D takes a bare `Gradient`, not the `GradientTexture1D` its GPU
 * sibling uses, so this resolves the sub-resource directly.
 */
export function resolveParticleGradient(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): Gradient | null {
  const resource = resolveSubResourceRef(ref, internalResources);
  if (!resource || resource.type !== 'Gradient') return null;
  return parseGradient(resource.data as Record<string, string>);
}
