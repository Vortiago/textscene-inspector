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
import { GodotRandomPCG, type SeedRef } from '../../../shared/cpuparticles/godotRng';
import { pickPoint, previewProcessRng, turnedByNormal } from '../../../shared/cpuparticles/emissionPoints';
import {
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
  basisColumnInto,
  basisCopy,
  basisDeterminantOf,
  basisFromColumns,
  basisOrthonormalize,
  basisSetColumn,
  IDENTITY_BASIS,
  type MutableBasis,
} from '../../../../godot/math/basis.js';
import { basisScale, basisSetAxisAngle, basisXform } from '../../../../godot/math/basisFloat.js';
import {
  affineInverseTransform3D,
  basisOfTransform3D,
  identityTransform3D,
  multiplyTransform3D,
  sameVector3,
  transform3DOf,
  transform3DXform,
  type Transform3D,
} from '../../../../godot/math/transform3d.js';
import { transform2DBasisXformInto, type Transform2DColumns } from '../../../../godot/math/transform2d.js';
import {
  normalizedVector3,
  vector3Add,
  vector3CrossInto,
  vector3DotComponents,
  vector3Length,
  vector3LengthSquared,
  vector3Lerp,
  vector3Mul,
  vector3NormalizeInto,
  vector3Scaled,
  vector3Set,
  type Vector2,
  type Vector3,
} from '../../../../godot/math/vector.js';
import { sortArray } from '../../../../godot/templates/sortArray.js';
import { colorAt, colorCount, vector3At, vector3Count } from '../../../../resources/shapes/packedElements';
import { CPUParticlesParameter } from '../../../../godot/scene/cpuParticles';
import { CPUParticles3DDrawOrder, EmissionShape } from '../../../../godot/scene/particles3d';
import {
  DEFAULT_PREVIEW_SEED,
  firstDrawnSteps,
  lerpParam,
  restartStep,
  sampleParam,
  settle,
  tintParticle,
  type ParticleCurves,
  type RestartClock,
  type RestartStep,
} from '../../../shared/cpuparticles/process';
import type { ParticleEmission } from '../../../../resources/materials/particleprocessmaterial/types';
import type { CPUParticles3DSimulation } from './types';
import { PARTICLE_COLOR_OFFSET, PARTICLE_CUSTOM_OFFSET, PARTICLE_FLOATS } from './particleBuffer';

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

/**
 * Godot's private `Particle` struct, the fields the process loop reads. Each particle owns its
 * basis, origin, velocity and colour, which every step writes in place.
 */
interface Particle {
  basis: MutableBasis;
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
const Y_AXIS: Vector3 = Object.freeze({ x: 0, y: 1, z: 0 });

interface SimState {
  time: number;
  cycle: number;
  emitting: boolean;
  particles: Particle[];
  seed: number;
  rng: GodotRandomPCG;
  /** `Math::rand()`, which picks each POINTS particle's point: see {@link previewProcessRng}. */
  processRng: GodotRandomPCG;
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
    processRng: previewProcessRng(),
    emissionXform: sim.localCoords ? identityTransform3D() : input.emissionTransform,
  };
  settle(sim, (frameTime) => particlesProcess(state, input, frameTime));
  for (const delta of firstDrawnSteps(sim)) particlesProcess(state, input, delta);
  return { input, state };
}

function newParticle(): Particle {
  return {
    basis: [...IDENTITY_BASIS],
    origin: { ...ZERO },
    color: { ...DEFAULT_COLOR },
    // `set_amount` writes `custom[3] = 1.0` into every slot (`cpu_particles_3d.cpp:80`).
    custom: [0, 0, 0, 1],
    velocity: { ...ZERO },
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

  const step: RestartStep = { restart: false, localDelta: 0 };
  for (let i = 0; i < pcount; i++) {
    const p = state.particles[i]!;
    if (!state.emitting && !p.active) continue;

    restartStep(clock, i, step);
    const { localDelta } = step;
    const restart = step.restart || p.time * (1.0 - sim.explosiveness) > p.lifetime;

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
    addScaled(p.origin, p.velocity, f(localDelta));
  }
}

/** `target += v * factor` in `real_t` float, in place. */
function addScaled(target: Vector3, v: Vector3, factor: number): void {
  target.x = f(target.x + f(v.x * factor));
  target.y = f(target.y + f(v.y * factor));
  target.z = f(target.z + f(v.z * factor));
}

/** The `restart` branch: a fresh draw from the per-particle RNG (`cpu_particles_3d.cpp:807-916`). */
function restartParticle(state: SimState, input: ParticleSim3DInput, p: Particle, index: number): void {
  const { sim, curves, colorInitialRamp } = input;
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

  copyVector3(p.velocity, sim.disableZ ? planarVelocity(sim, rng) : spreadVelocity(sim, rng));

  const angle = sim.params[CPUParticlesParameter.ANGLE]!;
  p.custom[0] = degToRadf(f(texAngle * lerpf(angle.min, angle.max, p.angleRand)));
  p.custom[1] = 0.0;
  const animOffset = sim.params[CPUParticlesParameter.ANIM_OFFSET]!;
  p.custom[2] = f(texAnimOffset * lerpf(animOffset.min, animOffset.max, p.animOffsetRand));
  // `lifetime_randomness` is a double, so the product and the difference are doubles.
  p.custom[3] = f(1.0 - rng.randf() * sim.lifetimeRandomness);
  basisCopy(p.basis, IDENTITY_BASIS);
  copyVector3(p.origin, ZERO);
  p.time = 0;
  p.lifetime = sim.lifetime * p.custom[3];
  p.baseColor = WHITE;

  emitAtShape(input, state, p);

  if (!sim.localCoords) {
    copyVector3(p.velocity, basisXform(basisOfTransform3D(state.emissionXform), p.velocity));
    const placed = multiplyTransform3D(state.emissionXform, transform3DOf(p.basis, p.origin));
    basisCopy(p.basis, basisOfTransform3D(placed));
    copyVector3(p.origin, placed.origin);
  }
  if (sim.disableZ) flattenZ(p);
}

/** Writes `v` into `out`, which the particle owns, so a step can write it in place. */
function copyVector3(out: Vector3, v: Vector3): void {
  vector3Set(out, v.x, v.y, v.z);
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

/** Where the emission shape places a newborn particle (`cpu_particles_3d.cpp:883-963`). */
function emitAtShape({ emission, sim }: ParticleSim3DInput, state: SimState, p: Particle): void {
  const { rng } = state;
  switch (emission.shape) {
    case EmissionShape.SPHERE: {
      const surface = sphereSurfacePoint(emission.sphereRadius, rng);
      copyVector3(p.origin, vector3Lerp(ZERO, surface, rng.randf()));
      break;
    }
    case EmissionShape.SPHERE_SURFACE:
      copyVector3(p.origin, sphereSurfacePoint(emission.sphereRadius, rng));
      break;
    case EmissionShape.BOX:
      copyVector3(p.origin, vector3Mul(boxCorner(rng), emission.boxExtents));
      break;
    case EmissionShape.POINTS:
      emitAtPoint(sim, state, p);
      break;
    case EmissionShape.DIRECTED_POINTS: {
      const index = emitAtPoint(sim, state, p);
      if (index !== null && vector3Count(sim.emissionNormals) === vector3Count(sim.emissionPoints)) {
        copyVector3(p.velocity, directedVelocity(sim, vector3At(sim.emissionNormals, index), p.velocity));
      }
      break;
    }
    case EmissionShape.RING:
      copyVector3(p.origin, ringPoint(emission, rng));
      break;
    default:
      // POINT emits from the origin, which `restartParticle` sets before the switch.
      break;
  }
}

/**
 * Places `p` on one of `emission_points`, with that point's colour when every point has one, and
 * returns its index. Null, and the origin kept, for no points (`:904-919`, `:939-941`).
 */
function emitAtPoint(sim: CPUParticles3DSimulation, state: SimState, p: Particle): number | null {
  const count = vector3Count(sim.emissionPoints);
  const index = pickPoint(state.processRng, count);
  if (index === null) return null;
  copyVector3(p.origin, vector3At(sim.emissionPoints, index));
  if (colorCount(sim.emissionColors) === count) p.baseColor = colorAt(sim.emissionColors, index);
  return index;
}

/**
 * The velocity turned into the frame of a point's normal (`:915-937`): in the XY plane for a
 * `disable_z` emitter, else into the tangent frame whose third axis is the normal.
 */
function directedVelocity(sim: CPUParticles3DSimulation, normal: Vector3, velocity: Vector3): Vector3 {
  if (sim.disableZ) return { ...turnedByNormal(normal, velocity), z: velocity.z };
  const v0 = Math.abs(normal.z) < 0.999 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const tangent = normalized(cross(v0, normal));
  const bitangent = normalized(cross(tangent, normal));
  return basisXform(basisFromColumns(tangent, bitangent, normal), velocity);
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

/** Scratch for `ringPoint`'s rotation about the ring axis, which `basisSetAxisAngle` overwrites whole. */
const ringRotation: MutableBasis = [...IDENTITY_BASIS];

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
  const axis = sameVector3(ringAxis, ZERO) ? { x: 0, y: 0, z: 1 } : normalized(ringAxis);
  const absAxis = { x: Math.abs(axis.x), y: Math.abs(axis.y), z: Math.abs(axis.z) };
  let ortho = sameVector3(absAxis, { x: 1, y: 0, z: 0 })
    ? cross({ x: 0, y: 1, z: 0 }, axis)
    : cross({ x: 1, y: 0, z: 0 }, axis);
  ortho = normalized(ortho);
  ortho = normalized(basisXform(basisSetAxisAngle(ringRotation, axis, angle), ortho));
  // `y_pos * height - height / 2.0` mixes in a double.
  const along = f(f(yPos * ringHeight) - ringHeight / 2.0);
  return vector3Add(vector3Scaled(ortho, radius), vector3Scaled(axis, along));
}

// Scratch, so a step allocates nothing. Each is valid only until the next call that writes it.

/** Written by `advanceParticle` from gravity at the start of each step, then summed into. */
const force: Vector3 = { x: 0, y: 0, z: 0 };
/** Written by `advanceParticle` at the start of each step: the particle's offset from the emitter. */
const diff: Vector3 = { x: 0, y: 0, z: 0 };
/** A unit vector `advanceParticle` and `addTangentialForce` write before each read. */
const unit: Vector3 = { x: 0, y: 0, z: 0 };
/** The two unit vectors `crossNormalsInto` writes on each call. */
const unitA: Vector3 = { x: 0, y: 0, z: 0 };
const unitB: Vector3 = { x: 0, y: 0, z: 0 };
/** The basis columns the orient functions write on each call. */
const xAxis: Vector3 = { x: 0, y: 0, z: 0 };
const yAxis: Vector3 = { x: 0, y: 0, z: 0 };
const zAxis: Vector3 = { x: 0, y: 0, z: 0 };
/** `alt_seed`: written by `advanceParticle` from `p.seed` at the start of each step. */
const stepSeed: SeedRef = { value: 0 };
/** `orbit`'s rotation and its turned offset, written on each call. */
const orbitRotation: { -readonly [K in keyof Transform2DColumns]: number } = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  tx: 0,
  ty: 0,
};
const orbitTurned: Vector2 = { x: 0, y: 0 };

/** The alive branch: integrate one step, returning the normalised age `tv` (`:977-1092`). */
function advanceParticle(
  state: SimState,
  input: ParticleSim3DInput,
  p: Particle,
  localDelta: number
): number {
  const { sim, curves } = input;
  stepSeed.value = p.seed;
  const { velocity } = p;

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

  vector3Set(force, sim.gravity.x, sim.gravity.y, sim.gravity.z);
  const emissionOrigin = state.emissionXform.origin;
  const positionZ = sim.disableZ ? 0 : p.origin.z;
  vector3Set(
    diff,
    f(p.origin.x - emissionOrigin.x),
    f(p.origin.y - emissionOrigin.y),
    f(positionZ - emissionOrigin.z)
  );

  // Each acceleration sits behind a C++ ternary, so its `rand_from_seed` draw is consumed only
  // when the branch is taken. Drawing unconditionally would desynchronise every later value.
  if (length(velocity) > 0.0) {
    const accel = lerpParam(sim.params, CPUParticlesParameter.LINEAR_ACCEL, stepSeed);
    addScaledTwice(force, normalizedInto(unit, velocity), texLinearAccel, accel);
  }
  if (length(diff) > 0.0) {
    const radial = lerpParam(sim.params, CPUParticlesParameter.RADIAL_ACCEL, stepSeed);
    addScaledTwice(force, normalizedInto(unit, diff), texRadialAccel, radial);
  }
  addTangentialForce(sim, diff, force, texTangentialAccel, stepSeed);

  addScaled(velocity, force, f(localDelta));

  if (sim.disableZ) orbit(sim, p, diff, texOrbitVelocity, localDelta, stepSeed);

  if (curves[CPUParticlesParameter.INITIAL_LINEAR_VELOCITY]) {
    // With a velocity curve, the speed is the curve, not an acceleration.
    scaleInto(velocity, normalizedInto(unit, velocity), texLinearVelocity);
  }

  if (f(sim.params[CPUParticlesParameter.DAMPING]!.max + texDamping) > 0.0) {
    const damp = f(texDamping * lerpParam(sim.params, CPUParticlesParameter.DAMPING, stepSeed));
    // `damp * local_delta` is a double, so the subtraction runs in double and rounds once.
    const speed = f(length(velocity) - damp * localDelta);
    if (speed < 0.0) vector3Set(velocity, 0, 0, 0);
    else scaleInto(velocity, normalizedInto(unit, velocity), speed);
  }

  const angle = sim.params[CPUParticlesParameter.ANGLE]!;
  let baseAngle = f(texAngle * lerpf(angle.min, angle.max, p.angleRand));
  // `custom[1] * lifetime` is a double, so the whole product is, and the sum rounds once.
  baseAngle = f(
    baseAngle +
      p.custom[1] *
        sim.lifetime *
        texAngularVelocity *
        lerpParam(sim.params, CPUParticlesParameter.ANGULAR_VELOCITY, stepSeed)
  );
  p.custom[0] = degToRadf(baseAngle);

  const animOffset = sim.params[CPUParticlesParameter.ANIM_OFFSET]!;
  const offset = f(texAnimOffset * lerpf(animOffset.min, animOffset.max, p.animOffsetRand));
  const progress = f(
    f(tv * texAnimSpeed) * lerpParam(sim.params, CPUParticlesParameter.ANIM_SPEED, stepSeed)
  );
  p.custom[2] = f(offset + progress);

  return tv;
}

/** `target += v * first * second` in `real_t` float, each product rounded in turn. */
function addScaledTwice(target: Vector3, v: Vector3, first: number, second: number): void {
  target.x = f(target.x + f(f(v.x * first) * second));
  target.y = f(target.y + f(f(v.y * first) * second));
  target.z = f(target.z + f(f(v.z * first) * second));
}

/** `out = v * factor` in `real_t` float. `out` may be `v`. */
function scaleInto(out: Vector3, v: Vector3, factor: number): void {
  vector3Set(out, f(v.x * factor), f(v.y * factor), f(v.z * factor));
}

/**
 * The tangential acceleration (`:1038-1046`), added to `force`: about Z in the XY plane with
 * `disable_z`, else along `diff × gravity`, so an emitter with no gravity has none.
 */
function addTangentialForce(
  sim: CPUParticles3DSimulation,
  diff: Vector3,
  force: Vector3,
  texTangentialAccel: number,
  seedRef: SeedRef
): void {
  // With `disable_z`, `yx * Vector2(-1, 1)` for `yx = Vector2(diff.y, diff.x)`, as long as `yx`.
  if (sim.disableZ) vector3Set(unit, -diff.y, diff.x, 0);
  else crossNormalsInto(unit, diff, sim.gravity);
  if (!(length(unit) > 0.0)) {
    positiveZeroes(force);
    return;
  }
  const accel = f(
    texTangentialAccel * lerpParam(sim.params, CPUParticlesParameter.TANGENTIAL_ACCEL, seedRef)
  );
  addScaled(force, normalizedInto(unit, unit), accel);
}

/** `force += Vector3()`: Godot adds a zero vector for no tangential force, which turns a -0 into +0. */
function positiveZeroes(v: Vector3): void {
  vector3Set(v, v.x + 0, v.y + 0, v.z + 0);
}

/** `out = a.normalized().cross(b.normalized())` in `real_t` float. */
function crossNormalsInto(out: Vector3, a: Vector3, b: Vector3): void {
  vector3CrossInto(out, normalizedInto(unitA, a), normalizedInto(unitB, b));
}

/** The orbit of a `disable_z` emitter about the emission origin, `diff` away (`:1050-1062`). */
function orbit(
  sim: CPUParticles3DSimulation,
  p: Particle,
  diff: Vector3,
  texOrbitVelocity: number,
  localDelta: number,
  seedRef: SeedRef
): void {
  const amount = f(texOrbitVelocity * lerpParam(sim.params, CPUParticlesParameter.ORBIT_VELOCITY, seedRef));
  if (amount === 0.0) return;
  // Godot rotates by -ang to match ParticleProcessMaterial's clockwise matrix.
  const ang = f(amount * localDelta * TAU);
  const cos = f(Math.cos(-ang));
  const sin = f(Math.sin(-ang));
  // `Transform2D(cos, sin, -sin, cos).basis_xform(diff)`, then `origin += rotated - diff` in the plane.
  orbitRotation.a = cos;
  orbitRotation.b = sin;
  orbitRotation.c = -sin;
  orbitRotation.d = cos;
  const rotated = transform2DBasisXformInto(orbitTurned, orbitRotation, diff);
  const { origin } = p;
  vector3Set(
    origin,
    f(f(origin.x - diff.x) + rotated.x),
    f(f(origin.y - diff.y) + rotated.y),
    f(origin.z + 0)
  );
}

/** Colour, orientation and scale, run for every particle (`cpu_particles_3d.cpp:1094-1212`). */
function applyAppearance(input: ParticleSim3DInput, p: Particle, tv: number): void {
  const { sim, curves, colorRamp } = input;

  const hueCurve = curves[CPUParticlesParameter.HUE_VARIATION] ?? null;
  // Unlike every other slot this one defaults to 0, not 1: with no curve there is no hue rotation.
  const texHueVariation = hueCurve ? f(sampleCurve(hueCurve, tv)) : 0.0;
  const hue = sim.params[CPUParticlesParameter.HUE_VARIATION]!;
  // `TAU` is a double, so the angle is one double product, rounded once.
  const hueAngle = f(texHueVariation * TAU * lerpf(hue.min, hue.max, p.hueRotRand));
  const base = colorRamp ? multiplyColor(sampleGradientColor(colorRamp, tv), sim.color) : sim.color;
  tintParticle(p, base, hueAngle);

  orient(sim, p);
  basisOrthonormalize(p.basis);
  scale(input, p, tv);
}

/** The basis before its scale: along the velocity, turned about Y, or the last one kept (`:1160-1199`). */
function orient(sim: CPUParticles3DSimulation, p: Particle): void {
  const { basis, velocity } = p;
  if (sim.disableZ) {
    if (sim.alignY) alignPlanarYToVelocity(basis, velocity);
    else turnInPlane(basis, p.custom[0]);
    return;
  }
  if (sim.alignY) alignYToVelocity(basis, velocity);
  else basisOrthonormalize(basis);
  if (sim.rotateY) basisSetAxisAngle(basis, Y_AXIS, p.custom[0]);
}

/** `disable_z` without `align_y`: the basis turned by `angle` in the XY plane. */
function turnInPlane(basis: MutableBasis, angle: number): void {
  const cos = f(Math.cos(angle));
  const sin = f(Math.sin(angle));
  basisSetColumn(basis, 0, vector3Set(xAxis, cos, -sin, 0));
  basisSetColumn(basis, 1, vector3Set(yAxis, sin, cos, 0));
  basisSetColumn(basis, 2, vector3Set(zAxis, 0, 0, 1));
}

/** `disable_z` with `align_y`: Y along the velocity, or kept for a still particle, and Z out of the plane. */
function alignPlanarYToVelocity(basis: MutableBasis, velocity: Vector3): void {
  const y = length(velocity) > 0.0 ? normalizedInto(yAxis, velocity) : basisColumnInto(yAxis, basis, 1);
  const x = normalizedInto(xAxis, vector3CrossInto(xAxis, y, basisColumnInto(zAxis, basis, 2)));
  basisSetColumn(basis, 0, x);
  basisSetColumn(basis, 1, y);
  basisSetColumn(basis, 2, vector3Set(zAxis, 0, 0, 1));
}

/** `align_y`: Y along the velocity, then the other two columns crossed in Godot's order. */
function alignYToVelocity(basis: MutableBasis, velocity: Vector3): void {
  const y =
    length(velocity) > 0.0
      ? normalizedInto(yAxis, velocity)
      : normalizedInto(yAxis, basisColumnInto(yAxis, basis, 1));
  const x = basisColumnInto(xAxis, basis, 0);
  const z = basisColumnInto(zAxis, basis, 2);
  if (sameVector3(y, x)) {
    normalizedInto(x, vector3CrossInto(x, y, z));
    normalizedInto(z, vector3CrossInto(z, x, y));
  } else {
    normalizedInto(z, vector3CrossInto(z, x, y));
    normalizedInto(x, vector3CrossInto(x, y, z));
  }
  basisSetColumn(basis, 0, x);
  basisSetColumn(basis, 1, y);
  basisSetColumn(basis, 2, z);
}

/** `tex_scale * lerp(scale range)`, each axis floored at `CMP_EPSILON`, scales the basis (`:1101-1122`, `:1201-1211`). */
function scale(input: ParticleSim3DInput, p: Particle, tv: number): void {
  const { sim } = input;
  let x = 1.0;
  let y = 1.0;
  let z = 1.0;
  if (sim.splitScale) {
    const curves = input.scaleCurves;
    if (curves.x) x = f(sampleCurve(curves.x, tv));
    if (curves.y) y = f(sampleCurve(curves.y, tv));
    if (curves.z) z = f(sampleCurve(curves.z, tv));
  } else {
    const curve = input.curves[CPUParticlesParameter.SCALE] ?? null;
    if (curve) x = y = z = f(sampleCurve(curve, tv));
  }
  const range = sim.params[CPUParticlesParameter.SCALE]!;
  const factor = lerpf(range.min, range.max, p.scaleRand);
  basisScale(
    p.basis,
    atLeastEpsilon(f(x * factor)),
    atLeastEpsilon(f(y * factor)),
    atLeastEpsilon(f(z * factor))
  );
}

function atLeastEpsilon(axis: number): number {
  return axis < CMP_EPSILON ? f(CMP_EPSILON) : axis;
}

function flattenZ(p: Particle): void {
  p.velocity.z = 0;
  p.origin.z = 0;
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
  if (basisDeterminantOf(basisOfTransform3D(global)) === 0) return identityTransform3D();
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

function dot(a: Vector3, b: Vector3): number {
  return vector3DotComponents(a.x, a.y, a.z, b.x, b.y, b.z);
}

/** `a.cross(b)` as a new vector, for the restart branch, which keeps it. */
function cross(a: Vector3, b: Vector3): Vector3 {
  return vector3CrossInto({ x: 0, y: 0, z: 0 }, a, b);
}

function normalizedInto(out: Vector3, v: Vector3): Vector3 {
  return vector3NormalizeInto(out, v.x, v.y, v.z);
}

function normalized(v: Vector3): Vector3 {
  const [x, y, z] = normalizedVector3(v.x, v.y, v.z);
  return { x, y, z };
}

function length(v: Vector3): number {
  return vector3Length(v.x, v.y, v.z);
}

function lengthSquared(v: Vector3): number {
  return vector3LengthSquared(v.x, v.y, v.z);
}
