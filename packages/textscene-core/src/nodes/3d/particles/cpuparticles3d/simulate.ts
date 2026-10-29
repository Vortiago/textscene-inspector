/**
 * CPUParticles3D's simulation, evaluated once to a frozen pose: a pure, React-free and THREE-free
 * port of `CPUParticles3D::_particles_process`, the settle loop `_update_internal` spends
 * `pre_process_time` through, and `_update_particle_data_buffer`, which writes the pose as the
 * multimesh buffer the renderer draws and the scene cull bounds.
 *
 * Derived from Godot Engine (`scene/3d/cpu_particles_3d.cpp`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Curve } from '../../../../resources/curves/curve/types';
import { sampleCurve } from '../../../../resources/curves/curve/sample';
import type { Gradient } from '../../../../resources/textures/gradienttexture2d/types';
// The pure `Gradient::get_color_at_offset` port, so no renderer enters the import closure.
import { sampleGradientColor } from '../../../../resources/textures/gradienttexture2d/sample';
import { GodotRandomPCG, randFromSeed, type SeedRef } from '../../../shared/cpuparticles/godotRng';
import {
  basisDeterminant,
  CMP_EPSILON,
  degToRad,
  degToRadf,
  lerpf,
  multiplyColor,
  TAU,
  type Rgba,
} from '../../../../godot/math/math.js';
import { storedReal as f } from '../../../../godot/math/real.js';
import {
  basisColumn,
  basisFromAxisAngle,
  basisOrthonormalized,
  basisScaledRows,
  type BasisComponents,
} from '../../../../godot/math/basis.js';
import {
  affineInverseTransform3D,
  basisOfTransform3D,
  identityTransform3D,
  multiplyTransform3D,
  transform3DOf,
  transform3DXform,
  type Transform3D,
} from '../../../../godot/math/transform3d.js';
import {
  normalizedVector3,
  vector3Add,
  vector3Cross,
  vector3Dot,
  vector3Length,
  vector3Lerp,
  vector3Mul,
  vector3Scaled,
  vector3Sub,
  type Vector3,
} from '../../../../godot/math/vector.js';
import { sortArray } from '../../../../godot/templates/sortArray.js';
import { CPUParticlesParameter } from '../../../../godot/scene/cpuParticles';
import { CPUParticles3DDrawOrder, EmissionShape } from '../../../../godot/scene/particles3d';
import type { EnumValue } from '../../../../godot/classdb/enumNames.js';
import {
  DEFAULT_PREVIEW_SEED,
  firstDrawnSteps,
  particleColor,
  restartStep,
  settle,
  type RestartClock,
} from '../../../shared/cpuparticles/process';
import type { ParticleEmission } from '../../../../resources/materials/particleprocessmaterial/types';
import type { CPUParticles3DSimulation } from './types';
import { PARTICLE_COLOR_OFFSET, PARTICLE_CUSTOM_OFFSET, PARTICLE_FLOATS } from './particleBuffer';

/** Godot's `Curve` slots, indexed by `CPUParticlesParameter`. Null where unset. */
type ParticleCurves = ReadonlyArray<Curve | null>;

export interface ParticleSim3DInput {
  sim: CPUParticles3DSimulation;
  /** The emission shape, which places each newborn particle. */
  emission: ParticleEmission;
  curves: ParticleCurves;
  /** `scale_curve_x`, `_y` and `_z`, read only with `split_scale`. */
  scaleCurves: { x: Curve | null; y: Curve | null; z: Curve | null };
  colorRamp: Gradient | null;
  colorInitialRamp: Gradient | null;
  /**
   * The emitter's global transform. A global-coords emitter spawns in world space, and the buffer
   * maps each particle back through its inverse.
   */
  emissionTransform: Transform3D;
}

/** Godot's private `Particle` struct, the fields the process loop reads. */
interface Particle {
  basis: BasisComponents;
  origin: Vector3;
  color: Rgba;
  custom: [number, number, number, number];
  velocity: Vector3;
  active: boolean;
  angleRand: number;
  scaleRand: number;
  hueRotRand: number;
  animOffsetRand: number;
  startColorRand: Rgba;
  time: number;
  lifetime: number;
  baseColor: Rgba;
  seed: number;
}

const WHITE: Rgba = Object.freeze({ r: 1, g: 1, b: 1, a: 1 });
/** `Color()`, which a never-born particle's colours hold (`color.h`). */
const DEFAULT_COLOR: Rgba = Object.freeze({ r: 0, g: 0, b: 0, a: 1 });
const ZERO: Vector3 = Object.freeze({ x: 0, y: 0, z: 0 });
const IDENTITY_BASIS: BasisComponents = [1, 0, 0, 0, 1, 0, 0, 0, 1];

interface SimState {
  time: number;
  cycle: number;
  emitting: boolean;
  particles: Particle[];
  seed: number;
  rng: GodotRandomPCG;
  /** `emission_xform`: the global transform, or the identity for a local-coords emitter. */
  emissionXform: Transform3D;
}

/** An emitter after its settle, which {@link particleDataBuffer} writes out. */
export interface SettledParticles {
  input: ParticleSim3DInput;
  /** Null for an emitter that is not emitting, which never settles. */
  state: SimState | null;
}

/**
 * Runs the emitter to the pose Godot first draws after its enter-tree settle. No clock: a running
 * emitter makes a golden unstable (ADR-0012), and the editor animates on wall clock, at an instant
 * no file or reference render can name.
 */
export function settleParticles(input: ParticleSim3DInput): SettledParticles {
  const { sim } = input;
  // `_update_internal` bails before touching the buffer when the emitter is neither active nor
  // emitting, and a scene file cannot make `active` true without `emitting`.
  if (!sim.emitting) return { input, state: null };

  const state: SimState = {
    time: 0,
    cycle: 0,
    emitting: true,
    particles: Array.from({ length: sim.amount }, newParticle),
    seed: (sim.useFixedSeed ? sim.seed : DEFAULT_PREVIEW_SEED) >>> 0,
    rng: new GodotRandomPCG(0),
    emissionXform: sim.localCoords ? identityTransform3D() : input.emissionTransform,
  };
  settle(sim, (frameTime) => particlesProcess(state, input, frameTime));
  for (const delta of firstDrawnSteps(sim)) particlesProcess(state, input, delta);
  return { input, state };
}

function newParticle(): Particle {
  return {
    basis: IDENTITY_BASIS,
    origin: ZERO,
    color: DEFAULT_COLOR,
    // `set_amount` writes `custom[3] = 1.0` into every slot (`cpu_particles_3d.cpp:80`).
    custom: [0, 0, 0, 1],
    velocity: ZERO,
    active: false,
    angleRand: 0,
    scaleRand: 0,
    hueRotRand: 0,
    animOffsetRand: 0,
    startColorRand: DEFAULT_COLOR,
    time: 0,
    lifetime: 0,
    baseColor: DEFAULT_COLOR,
    seed: 0,
  };
}

/**
 * `CPUParticles3D::_particles_process` (`cpu_particles_3d.cpp:691-1220`). Its first line is
 * `p_delta *= speed_scale`, which is absent here because every call is inside the settle, where
 * `speed_scale` is held at 1.
 */
function particlesProcess(state: SimState, input: ParticleSim3DInput, delta: number): void {
  const { sim } = input;
  const pcount = state.particles.length;

  const prevTime = state.time;
  state.time += delta;
  if (state.time > sim.lifetime) {
    state.time = state.time % sim.lifetime;
    state.cycle++;
    if (sim.oneShot && state.cycle > 0) state.emitting = false;
  }

  const clock: RestartClock = {
    pcount,
    cycle: state.cycle,
    prevTime,
    time: state.time,
    lifetime: sim.lifetime,
    delta,
    randomness: sim.randomness,
    explosiveness: sim.explosiveness,
    fractDelta: sim.fractDelta,
  };

  for (let i = 0; i < pcount; i++) {
    const p = state.particles[i]!;
    if (!state.emitting && !p.active) continue;

    let { restart, localDelta } = restartStep(clock, i);
    if (p.time * (1.0 - sim.explosiveness) > p.lifetime) restart = true;

    let tv = 0.0;
    if (restart) {
      if (!state.emitting) {
        p.active = false;
        continue;
      }
      restartParticle(state, input, p, i);
    } else if (!p.active) {
      continue;
    } else if (p.time > p.lifetime) {
      p.active = false;
      tv = 1.0;
    } else {
      tv = advanceParticle(state, input, p, localDelta);
    }

    applyAppearance(input, p, tv);

    if (sim.disableZ) flattenZ(p);
    // Godot integrates position after the appearance pass, and does it on the restart frame too,
    // so a newborn particle is already one step along.
    p.origin = vector3Add(p.origin, vector3Scaled(p.velocity, f(localDelta)));
  }
}

/** The `restart` branch: a fresh draw from the per-particle RNG (`cpu_particles_3d.cpp:807-916`). */
function restartParticle(state: SimState, input: ParticleSim3DInput, p: Particle, index: number): void {
  const { curves, colorInitialRamp } = input;
  const { sim } = input;
  const tv = 0.0;

  // Godot samples the angle curve for the anim offset too (`:822-830`). Same curve, same `tv`.
  const texAngle = sampleParam(curves, CPUParticlesParameter.ANGLE, tv);
  const texAnimOffset = texAngle;

  p.active = true;
  p.seed = (state.seed + 1 + index + Math.imul(state.cycle, state.particles.length)) >>> 0;
  const rng = state.rng;
  rng.seed(p.seed);
  p.angleRand = rng.randf();
  p.scaleRand = rng.randf();
  p.hueRotRand = rng.randf();
  p.animOffsetRand = rng.randf();
  p.startColorRand = colorInitialRamp ? sampleGradientColor(colorInitialRamp, rng.randf()) : WHITE;

  p.velocity = sim.disableZ ? planarVelocity(sim, rng) : spreadVelocity(sim, rng);

  const angle = sim.params[CPUParticlesParameter.ANGLE]!;
  p.custom[0] = degToRadf(f(texAngle * lerpf(angle.min, angle.max, p.angleRand)));
  p.custom[1] = 0.0;
  const animOffset = sim.params[CPUParticlesParameter.ANIM_OFFSET]!;
  p.custom[2] = f(texAnimOffset * lerpf(animOffset.min, animOffset.max, p.animOffsetRand));
  // `lifetime_randomness` is a double, so the product and the difference are doubles.
  p.custom[3] = f(1.0 - rng.randf() * sim.lifetimeRandomness);
  p.basis = IDENTITY_BASIS;
  p.origin = ZERO;
  p.time = 0;
  p.lifetime = sim.lifetime * p.custom[3];
  p.baseColor = WHITE;

  emitAtShape(input.emission, p, rng);

  if (!sim.localCoords) {
    p.velocity = basisXformRows(basisOfTransform3D(state.emissionXform), p.velocity);
    const placed = multiplyTransform3D(state.emissionXform, transform3DOf(p.basis, p.origin));
    p.basis = basisOfTransform3D(placed);
    p.origin = placed.origin;
  }
  if (sim.disableZ) flattenZ(p);
}

/** The velocity of a `particle_flag_disable_z` emitter: `direction` turned in the XY plane (`:839-843`). */
function planarVelocity(sim: CPUParticles3DSimulation, rng: GodotRandomPCG): Vector3 {
  // `(randf * 2.0 - 1.0) * spread` is a double, so `deg_to_rad` takes its double overload.
  const angle = f(
    f(Math.atan2(sim.direction.y, sim.direction.x)) + degToRad((rng.randf() * 2.0 - 1.0) * sim.spread)
  );
  const rot = { x: f(Math.cos(angle)), y: f(Math.sin(angle)), z: 0 };
  return vector3Scaled(rot, initialSpeed(sim, rng));
}

/** The velocity spread in 3D about `direction`, its second axis flattened by `flatness` (`:844-871`). */
function spreadVelocity(sim: CPUParticles3DSimulation, rng: GodotRandomPCG): Vector3 {
  const angle1 = degToRadf(f(f(f(rng.randf() * 2) - 1) * sim.spread));
  const angle2 = degToRadf(f(f(f(f(rng.randf() * 2) - 1) * f(1 - sim.flatness)) * sim.spread));

  const directionXz = { x: f(Math.sin(angle1)), y: 0, z: f(Math.cos(angle1)) };
  const directionYz = { x: 0, y: f(Math.sin(angle2)), z: f(Math.cos(angle2)) };
  const spread = {
    x: f(directionXz.x * directionYz.z),
    y: directionYz.y,
    z: f(directionXz.z * directionYz.z),
  };
  const direction = lengthSquared(sim.direction) > 0 ? normalized(sim.direction) : { x: 0, y: 0, z: 1 };
  // Turn the spread onto `direction`. One parallel to Y takes Z as its binormal.
  let binormal = cross({ x: 0, y: 1, z: 0 }, direction);
  if (lengthSquared(binormal) < 0.00000001) binormal = { x: 0, y: 0, z: 1 };
  binormal = normalized(binormal);
  const normal = cross(binormal, direction);
  const turned = vector3Add(
    vector3Add(vector3Scaled(binormal, spread.x), vector3Scaled(normal, spread.y)),
    vector3Scaled(direction, spread.z)
  );
  return vector3Scaled(turned, initialSpeed(sim, rng));
}

function initialSpeed(sim: CPUParticles3DSimulation, rng: GodotRandomPCG): number {
  const velocity = sim.params[CPUParticlesParameter.INITIAL_LINEAR_VELOCITY]!;
  return lerpf(velocity.min, velocity.max, rng.randf());
}

/** Where the emission shape places a newborn particle (`cpu_particles_3d.cpp:883-947`). */
function emitAtShape(emission: ParticleEmission, p: Particle, rng: GodotRandomPCG): void {
  switch (emission.shape) {
    case EmissionShape.SPHERE: {
      const surface = sphereSurfacePoint(emission.sphereRadius, rng);
      p.origin = vector3Lerp(ZERO, surface, rng.randf());
      break;
    }
    case EmissionShape.SPHERE_SURFACE:
      p.origin = sphereSurfacePoint(emission.sphereRadius, rng);
      break;
    case EmissionShape.BOX:
      p.origin = vector3Mul(boxCorner(rng), emission.boxExtents);
      break;
    case EmissionShape.RING:
      p.origin = ringPoint(emission, rng);
      break;
    default:
      // A point, and the point shapes this preview cannot place, leave the origin alone.
      break;
  }
}

/** A point on the sphere of `radius`, from a height and an angle drawn in that order (`:888-899`). */
function sphereSurfacePoint(radius: number, rng: GodotRandomPCG): Vector3 {
  const s = f(2.0 * rng.randf() - 1.0);
  const t = f(TAU * rng.randf());
  const slice = sphereSliceRadius(radius, s);
  return { x: f(slice * f(Math.cos(t))), y: f(slice * f(Math.sin(t))), z: f(radius * s) };
}

/** `radius * Math::sqrt(1.0 - s * s)`: `1.0 - s * s` mixes a double with a float product. */
function sphereSliceRadius(radius: number, s: number): number {
  return f(radius * Math.sqrt(1.0 - f(s * s)));
}

/**
 * `Vector3(randf * 2.0 - 1.0, …, …)` (`:907`). C++ leaves the argument order unspecified, and GCC
 * evaluates the last first, as CPUParticles2D's measured rectangle shows.
 */
function boxCorner(rng: GodotRandomPCG): Vector3 {
  const z = f(rng.randf() * 2.0 - 1.0);
  const y = f(rng.randf() * 2.0 - 1.0);
  const x = f(rng.randf() * 2.0 - 1.0);
  return { x, y, z };
}

/** A point in the ring's cone frustum (`cpu_particles_3d.cpp:948-969`). */
function ringPoint(emission: ParticleEmission, rng: GodotRandomPCG): Vector3 {
  const { ringRadius, ringInnerRadius, ringHeight, ringConeAngle, ringAxis } = emission;
  const radiusClamped = f(Math.max(0.001, ringRadius));
  // `90.0 - cone_angle` is a double, so the tangent and the subtraction are doubles.
  const topRadius = f(Math.max(radiusClamped - Math.tan(degToRad(90.0 - ringConeAngle)) * ringHeight, 0.0));
  let yPos = rng.randf();
  const skew = f(Math.max(f(Math.min(radiusClamped, topRadius) / Math.max(radiusClamped, topRadius)), 0.5));
  yPos = radiusClamped < topRadius ? f(Math.pow(yPos, skew)) : f(1.0 - f(Math.pow(yPos, skew)));
  const angle = f(f(rng.randf()) * TAU);
  const innerSquared = f(ringInnerRadius * ringInnerRadius);
  let radius = f(
    Math.sqrt(f(f(rng.randf() * f(f(radiusClamped * radiusClamped) - innerSquared)) + innerSquared))
  );
  radius = lerpf(radius, f(radius * f(topRadius / radiusClamped)), yPos);
  const axis = sameVector(ringAxis, ZERO) ? { x: 0, y: 0, z: 1 } : normalized(ringAxis);
  const absAxis = { x: Math.abs(axis.x), y: Math.abs(axis.y), z: Math.abs(axis.z) };
  let ortho = sameVector(absAxis, { x: 1, y: 0, z: 0 })
    ? cross({ x: 0, y: 1, z: 0 }, axis)
    : cross({ x: 1, y: 0, z: 0 }, axis);
  ortho = normalized(ortho);
  ortho = normalized(basisXformRows(basisFromAxisAngle(axis, angle), ortho));
  // `y_pos * height - height / 2.0` mixes in a double.
  const along = f(f(yPos * ringHeight) - ringHeight / 2.0);
  return vector3Add(vector3Scaled(ortho, radius), vector3Scaled(axis, along));
}

/** The alive branch: integrate one step, returning the normalised age `tv` (`:977-1092`). */
function advanceParticle(
  state: SimState,
  input: ParticleSim3DInput,
  p: Particle,
  localDelta: number
): number {
  const { curves } = input;
  const { sim } = input;
  const seedRef: SeedRef = { value: p.seed };

  p.time += localDelta;
  p.custom[1] = f(p.time / sim.lifetime);
  const tv = f(p.time / p.lifetime);

  const texLinearVelocity = sampleParam(curves, CPUParticlesParameter.INITIAL_LINEAR_VELOCITY, tv);
  const texOrbitVelocity = sim.disableZ ? sampleParam(curves, CPUParticlesParameter.ORBIT_VELOCITY, tv) : 1.0;
  const texAngularVelocity = sampleParam(curves, CPUParticlesParameter.ANGULAR_VELOCITY, tv);
  const texLinearAccel = sampleParam(curves, CPUParticlesParameter.LINEAR_ACCEL, tv);
  const texTangentialAccel = sampleParam(curves, CPUParticlesParameter.TANGENTIAL_ACCEL, tv);
  const texRadialAccel = sampleParam(curves, CPUParticlesParameter.RADIAL_ACCEL, tv);
  const texDamping = sampleParam(curves, CPUParticlesParameter.DAMPING, tv);
  const texAngle = sampleParam(curves, CPUParticlesParameter.ANGLE, tv);
  const texAnimSpeed = sampleParam(curves, CPUParticlesParameter.ANIM_SPEED, tv);
  const texAnimOffset = sampleParam(curves, CPUParticlesParameter.ANIM_OFFSET, tv);

  let force: Vector3 = sim.gravity;
  const position = sim.disableZ ? { ...p.origin, z: 0 } : p.origin;

  // Each acceleration sits behind a C++ ternary, so its `rand_from_seed` draw is consumed only
  // when the branch is taken. Drawing unconditionally would desynchronise every later value.
  if (length(p.velocity) > 0.0) {
    const accel = lerpParam(sim, CPUParticlesParameter.LINEAR_ACCEL, seedRef);
    force = vector3Add(force, vector3Scaled(vector3Scaled(normalized(p.velocity), texLinearAccel), accel));
  }
  const diff = vector3Sub(position, state.emissionXform.origin);
  if (length(diff) > 0.0) {
    const radial = lerpParam(sim, CPUParticlesParameter.RADIAL_ACCEL, seedRef);
    force = vector3Add(force, vector3Scaled(vector3Scaled(normalized(diff), texRadialAccel), radial));
  }
  force = vector3Add(force, tangentialForce(sim, diff, texTangentialAccel, seedRef));

  p.velocity = vector3Add(p.velocity, vector3Scaled(force, f(localDelta)));

  if (sim.disableZ) orbit(sim, p, diff, texOrbitVelocity, localDelta, seedRef);

  if (curves[CPUParticlesParameter.INITIAL_LINEAR_VELOCITY]) {
    // With a velocity curve, the speed is the curve, not an acceleration.
    p.velocity = vector3Scaled(normalized(p.velocity), texLinearVelocity);
  }

  if (f(sim.params[CPUParticlesParameter.DAMPING]!.max + texDamping) > 0.0) {
    const damp = f(texDamping * lerpParam(sim, CPUParticlesParameter.DAMPING, seedRef));
    // `damp * local_delta` is a double, so the subtraction runs in double and rounds once.
    const speed = f(length(p.velocity) - damp * localDelta);
    p.velocity = speed < 0.0 ? ZERO : vector3Scaled(normalized(p.velocity), speed);
  }

  const angle = sim.params[CPUParticlesParameter.ANGLE]!;
  let baseAngle = f(texAngle * lerpf(angle.min, angle.max, p.angleRand));
  // `custom[1] * lifetime` is a double, so the whole product is, and the sum rounds once.
  baseAngle = f(
    baseAngle +
      p.custom[1] *
        sim.lifetime *
        texAngularVelocity *
        lerpParam(sim, CPUParticlesParameter.ANGULAR_VELOCITY, seedRef)
  );
  p.custom[0] = degToRadf(baseAngle);

  const animOffset = sim.params[CPUParticlesParameter.ANIM_OFFSET]!;
  const offset = f(texAnimOffset * lerpf(animOffset.min, animOffset.max, p.animOffsetRand));
  const progress = f(f(tv * texAnimSpeed) * lerpParam(sim, CPUParticlesParameter.ANIM_SPEED, seedRef));
  p.custom[2] = f(offset + progress);

  return tv;
}

/**
 * The tangential acceleration (`:1038-1046`): about Z in the XY plane with `disable_z`, else along
 * `diff × gravity`, so an emitter with no gravity has none.
 */
function tangentialForce(
  sim: CPUParticles3DSimulation,
  diff: Vector3,
  texTangentialAccel: number,
  seedRef: SeedRef
): Vector3 {
  // With `disable_z`, `yx * Vector2(-1, 1)` for `yx = Vector2(diff.y, diff.x)`, as long as `yx`.
  const along = sim.disableZ
    ? { x: -diff.y, y: diff.x, z: 0 }
    : cross(normalized(diff), normalized(sim.gravity));
  if (!(length(along) > 0.0)) return ZERO;
  return vector3Scaled(
    normalized(along),
    f(texTangentialAccel * lerpParam(sim, CPUParticlesParameter.TANGENTIAL_ACCEL, seedRef))
  );
}

/** The orbit of a `disable_z` emitter about the emission origin (`:1050-1062`). */
function orbit(
  sim: CPUParticles3DSimulation,
  p: Particle,
  diff: Vector3,
  texOrbitVelocity: number,
  localDelta: number,
  seedRef: SeedRef
): void {
  const amount = f(texOrbitVelocity * lerpParam(sim, CPUParticlesParameter.ORBIT_VELOCITY, seedRef));
  if (amount === 0.0) return;
  // Godot rotates by -ang to match ParticleProcessMaterial's clockwise matrix.
  const ang = f(amount * localDelta * TAU);
  const cos = f(Math.cos(-ang));
  const sin = f(Math.sin(-ang));
  // `Transform2D(-ang, Vector2()).basis_xform(diff.xy)`: columns `(cos, sin)` and `(-sin, cos)`.
  const rotated = {
    x: f(f(cos * diff.x) + f(-sin * diff.y)),
    y: f(f(sin * diff.x) + f(cos * diff.y)),
    z: 0,
  };
  p.origin = vector3Add(vector3Sub(p.origin, { x: diff.x, y: diff.y, z: 0 }), rotated);
}

/** Colour, orientation and scale, run for every particle (`cpu_particles_3d.cpp:1094-1212`). */
function applyAppearance(input: ParticleSim3DInput, p: Particle, tv: number): void {
  const { curves, colorRamp } = input;
  const { sim } = input;

  const hueCurve = curves[CPUParticlesParameter.HUE_VARIATION] ?? null;
  // Unlike every other slot this one defaults to 0, not 1: with no curve there is no hue rotation.
  const texHueVariation = hueCurve ? f(sampleCurve(hueCurve, tv)) : 0.0;
  const hue = sim.params[CPUParticlesParameter.HUE_VARIATION]!;
  // `TAU` is a double, so the angle is one double product, rounded once.
  const hueAngle = f(texHueVariation * TAU * lerpf(hue.min, hue.max, p.hueRotRand));
  const base = colorRamp ? multiplyColor(sampleGradientColor(colorRamp, tv), sim.color) : sim.color;
  p.color = particleColor({ base, hueAngle, baseColor: p.baseColor, startColorRand: p.startColorRand });

  p.basis = basisOrthonormalized(orientedBasis(sim, p));
  p.basis = basisScaledRows(p.basis, particleScale(input, p, tv));
}

/** The basis before its scale: along the velocity, turned about Y, or the last one kept (`:1160-1199`). */
function orientedBasis(sim: CPUParticles3DSimulation, p: Particle): BasisComponents {
  if (sim.disableZ) {
    if (!sim.alignY) {
      const cos = f(Math.cos(p.custom[0]));
      const sin = f(Math.sin(p.custom[0]));
      return basisOfColumns({ x: cos, y: -sin, z: 0 }, { x: sin, y: cos, z: 0 }, { x: 0, y: 0, z: 1 });
    }
    const y = length(p.velocity) > 0.0 ? normalized(p.velocity) : column(p.basis, 1);
    return basisOfColumns(normalized(cross(y, column(p.basis, 2))), y, { x: 0, y: 0, z: 1 });
  }
  let basis = p.basis;
  if (sim.alignY) {
    const y = length(p.velocity) > 0.0 ? normalized(p.velocity) : normalized(column(basis, 1));
    let x = column(basis, 0);
    let z = column(basis, 2);
    if (sameVector(y, x)) {
      x = normalized(cross(y, z));
      z = normalized(cross(x, y));
    } else {
      z = normalized(cross(x, y));
      x = normalized(cross(y, z));
    }
    basis = basisOfColumns(x, y, z);
  } else {
    basis = basisOrthonormalized(basis);
  }
  if (sim.rotateY) basis = basisFromAxisAngle({ x: 0, y: 1, z: 0 }, p.custom[0]);
  return basis;
}

/** `tex_scale * lerp(scale range)`, each axis floored at `CMP_EPSILON` (`:1101-1122`, `:1201-1211`). */
function particleScale(input: ParticleSim3DInput, p: Particle, tv: number): Vector3 {
  const { sim } = input;
  let texScale: Vector3 = { x: 1, y: 1, z: 1 };
  if (sim.splitScale) {
    const { x, y, z } = input.scaleCurves;
    texScale = {
      x: x ? f(sampleCurve(x, tv)) : 1.0,
      y: y ? f(sampleCurve(y, tv)) : 1.0,
      z: z ? f(sampleCurve(z, tv)) : 1.0,
    };
  } else {
    const curve = input.curves[CPUParticlesParameter.SCALE] ?? null;
    if (curve) {
      const scale = f(sampleCurve(curve, tv));
      texScale = { x: scale, y: scale, z: scale };
    }
  }
  const range = sim.params[CPUParticlesParameter.SCALE]!;
  const scaled = vector3Scaled(texScale, lerpf(range.min, range.max, p.scaleRand));
  const floor = (axis: number) => (axis < CMP_EPSILON ? f(CMP_EPSILON) : axis);
  return { x: floor(scaled.x), y: floor(scaled.y), z: floor(scaled.z) };
}

function flattenZ(p: Particle): void {
  p.velocity = { ...p.velocity, z: 0 };
  p.origin = { ...p.origin, z: 0 };
}

/**
 * `_update_particle_data_buffer` (`cpu_particles_3d.cpp:1230-1318`): `PARTICLE_FLOATS` per particle
 * in index order, relative to the emitter node. An inactive particle writes a zero transform.
 * {@link particlesInDrawOrder} sorts them, and no other reader depends on the order.
 */
export function particleRows({ input, state }: SettledParticles): Float32Array {
  const { sim } = input;
  // The multimesh keeps the zeroed buffer `multimesh_allocate_data` gave it, every instance drawn.
  if (!state) return new Float32Array(sim.amount * PARTICLE_FLOATS);
  const inverseEmission = inverseEmissionTransform(input.emissionTransform);
  const rows = new Float32Array(state.particles.length * PARTICLE_FLOATS);
  state.particles.forEach((p, index) => {
    const at = index * PARTICLE_FLOATS;
    if (p.active) {
      const local = transform3DOf(p.basis, p.origin);
      writeTransformRows(rows, at, sim.localCoords ? local : multiplyTransform3D(inverseEmission, local));
    }
    writeColor(rows, at + PARTICLE_COLOR_OFFSET, p.color);
    rows.set(p.custom, at + PARTICLE_CUSTOM_OFFSET);
  });
  return rows;
}

/**
 * `rows` in Godot's draw order (`:1239-1271`), and `rows` itself for the index order. `viewAxis` is
 * the global Z axis of the camera the viewport renders through, which `VIEW_DEPTH` sorts along.
 * Null for none, where Godot keeps the index order.
 */
export function particlesInDrawOrder(
  { input, state }: SettledParticles,
  rows: Float32Array,
  viewAxis: Vector3 | null
): Float32Array {
  const order = state && drawOrder(state, input, viewAxis);
  if (!order) return rows;
  const sorted = new Float32Array(rows.length);
  order.forEach((index, slot) => {
    sorted.set(rows.subarray(index * PARTICLE_FLOATS, (index + 1) * PARTICLE_FLOATS), slot * PARTICLE_FLOATS);
  });
  return sorted;
}

/**
 * `inv_emission_transform`, which `NOTIFICATION_TRANSFORM_CHANGED` writes only for a basis with a
 * non-zero determinant (`cpu_particles_3d.cpp:1378-1383`), so a zero-scaled emitter keeps the
 * identity it was built with.
 */
function inverseEmissionTransform(global: Transform3D): Transform3D {
  const { basis_x: x, basis_y: y, basis_z: z } = global;
  if (basisDeterminant(x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z) === 0) return identityTransform3D();
  return affineInverseTransform3D(global);
}

/** The particle indices in draw order, or null for the index order. */
function drawOrder(state: SimState, input: ParticleSim3DInput, viewAxis: Vector3 | null): number[] | null {
  const { sim } = input;
  const { particles } = state;
  if (sim.drawOrder === CPUParticles3DDrawOrder.LIFETIME) {
    return sortedIndices(particles.length, (a, b) => particles[a]!.time > particles[b]!.time);
  }
  if (sim.drawOrder !== CPUParticles3DDrawOrder.VIEW_DEPTH || !viewAxis) return null;
  // Far to near. A local-coords emitter takes the axis through its whole inverse, origin and all.
  const axis = sim.localCoords
    ? normalized(transform3DXform(inverseEmissionTransform(input.emissionTransform), viewAxis))
    : normalized(viewAxis);
  // Each depth once, not twice per comparison.
  const depths = particles.map((p) => dot(axis, p.origin));
  return sortedIndices(particles.length, (a, b) => depths[a]! < depths[b]!);
}

/** The indices below `count`, in the order Godot's `SortArray` gives them under `less`. */
function sortedIndices(count: number, less: (a: number, b: number) => boolean): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  sortArray(order, less);
  return order;
}

/** A transform's three rows and origin as the buffer stores them: each row then its origin component. */
function writeTransformRows(buffer: Float32Array, at: number, t: Transform3D): void {
  const { basis_x: x, basis_y: y, basis_z: z, origin } = t;
  buffer[at] = x.x;
  buffer[at + 1] = x.y;
  buffer[at + 2] = x.z;
  buffer[at + 3] = origin.x;
  buffer[at + 4] = y.x;
  buffer[at + 5] = y.y;
  buffer[at + 6] = y.z;
  buffer[at + 7] = origin.y;
  buffer[at + 8] = z.x;
  buffer[at + 9] = z.y;
  buffer[at + 10] = z.z;
  buffer[at + 11] = origin.z;
}

function writeColor(buffer: Float32Array, at: number, { r, g, b, a }: Rgba): void {
  buffer[at] = r;
  buffer[at + 1] = g;
  buffer[at + 2] = b;
  buffer[at + 3] = a;
}

function sampleParam(
  curves: ParticleCurves,
  param: EnumValue<typeof CPUParticlesParameter>,
  tv: number
): number {
  const curve = curves[param] ?? null;
  return curve ? f(sampleCurve(curve, tv)) : 1.0;
}

/** `Math::lerp(parameters_min[p], parameters_max[p], rand_from_seed(seed))`. */
function lerpParam(
  sim: CPUParticles3DSimulation,
  param: EnumValue<typeof CPUParticlesParameter>,
  seedRef: SeedRef
): number {
  const slot = sim.params[param]!;
  return lerpf(slot.min, slot.max, randFromSeed(seedRef));
}

function basisOfColumns(x: Vector3, y: Vector3, z: Vector3): BasisComponents {
  return [x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z];
}

function column(basis: BasisComponents, index: number): Vector3 {
  const [x, y, z] = basisColumn(basis, index);
  return { x, y, z };
}

/** `Basis::xform` (`basis.h:336-341`) of a row-major basis: each row dotted with `v`. */
function basisXformRows(b: BasisComponents, v: Vector3): Vector3 {
  return {
    x: dot({ x: b[0], y: b[1], z: b[2] }, v),
    y: dot({ x: b[3], y: b[4], z: b[5] }, v),
    z: dot({ x: b[6], y: b[7], z: b[8] }, v),
  };
}

function dot(a: Vector3, b: Vector3): number {
  return vector3Dot([a.x, a.y, a.z], [b.x, b.y, b.z]);
}

function cross(a: Vector3, b: Vector3): Vector3 {
  const [x, y, z] = vector3Cross([a.x, a.y, a.z], [b.x, b.y, b.z]);
  return { x, y, z };
}

function normalized(v: Vector3): Vector3 {
  const [x, y, z] = normalizedVector3(v.x, v.y, v.z);
  return { x, y, z };
}

function length(v: Vector3): number {
  return vector3Length(v.x, v.y, v.z);
}

function lengthSquared(v: Vector3): number {
  return dot(v, v);
}

function sameVector(a: Vector3, b: Vector3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
