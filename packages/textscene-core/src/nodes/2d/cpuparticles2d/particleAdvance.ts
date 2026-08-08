/**
 * The alive branch of `CPUParticles2D::_particles_process`: one integration
 * step for a particle that neither restarted nor died this frame.
 *
 * Part of the CPUParticles2D port; the derivation notice is in `simulate.ts`.
 */

import type { Vector2 } from '../../base/node2d/types';
import { sampleCurve } from '../../../resources/curves/curve/sample';
import { randFromSeed, type SeedRef } from './godotRng';
import { degToRad, lerp } from './particleMath';
import type { Particle, ParticleCurves, ParticleSimInput, SimState } from './simTypes';
import { CPUParticles2DParam, type CPUParticles2DProperties } from './types';

/** The alive branch: integrate one step, returning the normalised age `tv`. */
export function advanceParticle(
  state: SimState,
  input: ParticleSimInput,
  p: Particle,
  localDelta: number
): number {
  const { props, curves } = input;
  const seedRef: SeedRef = { value: p.seed };

  p.time += localDelta;
  p.custom[1] = p.time / state.lifetime;
  const tv = p.time / p.lifetime;

  const texLinearVelocity = sampleParam(curves, CPUParticles2DParam.InitialLinearVelocity, tv);
  const texOrbitVelocity = sampleParam(curves, CPUParticles2DParam.OrbitVelocity, tv);
  const texAngularVelocity = sampleParam(curves, CPUParticles2DParam.AngularVelocity, tv);
  const texLinearAccel = sampleParam(curves, CPUParticles2DParam.LinearAccel, tv);
  const texTangentialAccel = sampleParam(curves, CPUParticles2DParam.TangentialAccel, tv);
  const texRadialAccel = sampleParam(curves, CPUParticles2DParam.RadialAccel, tv);
  const texDamping = sampleParam(curves, CPUParticles2DParam.Damping, tv);
  const texAngle = sampleParam(curves, CPUParticles2DParam.Angle, tv);
  const texAnimSpeed = sampleParam(curves, CPUParticles2DParam.AnimSpeed, tv);
  const texAnimOffset = sampleParam(curves, CPUParticles2DParam.AnimOffset, tv);

  const force: Vector2 = { x: props.gravity.x, y: props.gravity.y };
  const pos: Vector2 = { x: p.transform.ox, y: p.transform.oy };

  // Each of the three accelerations sits behind a C++ ternary, so its
  // `rand_from_seed` draw is CONSUMED ONLY when the branch is taken. Drawing
  // unconditionally would desynchronise every later value in the same step.
  const speed = Math.hypot(p.velocity.x, p.velocity.y);
  if (speed > 0) {
    const accel = texLinearAccel * lerpParam(props, CPUParticles2DParam.LinearAccel, seedRef);
    force.x += (p.velocity.x / speed) * accel;
    force.y += (p.velocity.y / speed) * accel;
  }

  // Radial and tangential acceleration are both measured from the emitter's
  // own origin, which for a global-coords emitter is its world position.
  const diff: Vector2 = { x: pos.x - state.emissionXform.ox, y: pos.y - state.emissionXform.oy };
  const diffLength = Math.hypot(diff.x, diff.y);
  if (diffLength > 0) {
    const radial = texRadialAccel * lerpParam(props, CPUParticles2DParam.RadialAccel, seedRef);
    force.x += (diff.x / diffLength) * radial;
    force.y += (diff.y / diffLength) * radial;
  }

  // `yx` is `(diff.y, diff.x)` mirrored in X — the perpendicular Godot spins
  // tangential acceleration around. Its length is `diff`'s.
  if (diffLength > 0) {
    const tangential =
      texTangentialAccel * lerpParam(props, CPUParticles2DParam.TangentialAccel, seedRef);
    force.x += (-diff.y / diffLength) * tangential;
    force.y += (diff.x / diffLength) * tangential;
  }

  p.velocity.x += force.x * localDelta;
  p.velocity.y += force.y * localDelta;

  const orbitAmount = texOrbitVelocity * lerpParam(props, CPUParticles2DParam.OrbitVelocity, seedRef);
  if (orbitAmount !== 0.0) {
    // Godot rotates by -ang to match ParticleProcessMaterial's clockwise matrix.
    const ang = orbitAmount * localDelta * 2 * Math.PI;
    const cr = Math.cos(-ang);
    const sr = Math.sin(-ang);
    p.transform.ox += -diff.x + (cr * diff.x - sr * diff.y);
    p.transform.oy += -diff.y + (sr * diff.x + cr * diff.y);
  }

  if (curves[CPUParticles2DParam.InitialLinearVelocity]) {
    // With a velocity curve the SPEED is the curve, not an acceleration.
    const length = Math.hypot(p.velocity.x, p.velocity.y);
    if (length > 0) {
      p.velocity.x = (p.velocity.x / length) * texLinearVelocity;
      p.velocity.y = (p.velocity.y / length) * texLinearVelocity;
    }
  }

  if (props.params[CPUParticles2DParam.Damping]!.max + texDamping > 0.0) {
    let v = Math.hypot(p.velocity.x, p.velocity.y);
    const damp = texDamping * lerpParam(props, CPUParticles2DParam.Damping, seedRef);
    v -= damp * localDelta;
    if (v < 0.0) {
      p.velocity = { x: 0, y: 0 };
    } else {
      const length = Math.hypot(p.velocity.x, p.velocity.y);
      if (length > 0) {
        p.velocity.x = (p.velocity.x / length) * v;
        p.velocity.y = (p.velocity.y / length) * v;
      }
    }
  }

  const angleParam = props.params[CPUParticles2DParam.Angle]!;
  let baseAngle = texAngle * lerp(angleParam.min, angleParam.max, p.angleRand);
  baseAngle +=
    p.custom[1] *
    state.lifetime *
    texAngularVelocity *
    lerpParam(props, CPUParticles2DParam.AngularVelocity, seedRef);
  p.rotation = degToRad(baseAngle);

  const animOffset = props.params[CPUParticles2DParam.AnimOffset]!;
  p.custom[2] =
    texAnimOffset * lerp(animOffset.min, animOffset.max, p.animOffsetRand) +
    tv * texAnimSpeed * lerpParam(props, CPUParticles2DParam.AnimSpeed, seedRef);

  return tv;
}

function sampleParam(curves: ParticleCurves, param: CPUParticles2DParam, tv: number): number {
  const curve = curves[param] ?? null;
  return curve ? sampleCurve(curve, tv) : 1.0;
}

/** `Math::lerp(parameters_min[p], parameters_max[p], rand_from_seed(seed))`. */
function lerpParam(
  props: CPUParticles2DProperties,
  param: CPUParticles2DParam,
  seedRef: SeedRef
): number {
  const slot = props.params[param]!;
  return lerp(slot.min, slot.max, randFromSeed(seedRef));
}
