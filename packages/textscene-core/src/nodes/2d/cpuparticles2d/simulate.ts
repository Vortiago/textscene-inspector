/**
 * CPUParticles2D's simulation, evaluated once to a frozen pose: a pure, React-free
 * and THREE-free port of `CPUParticles2D::_particles_process` and the settle loop
 * `_update_internal` spends `pre_process_time` through (`cpu_particles_2d.cpp:727-738`).
 *
 * Derived from Godot Engine (`scene/2d/cpu_particles_2d.cpp`), used under the
 * MIT licence:
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

import { sampleCurve } from '../../../resources/curves/curve/sample';
import type { Curve } from '../../../resources/curves/curve/types';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
// The pure `Gradient::get_color_at_offset` port, so no renderer enters the import closure.
import { sampleGradientColor, storedGradient } from '../../../resources/textures/gradienttexture2d/sample';
import { GodotRandomPCG, type SeedRef } from '../../shared/cpuparticles/godotRng';
import {
  pickPoint,
  previewProcessRng,
  processRandf,
  turnedByNormal,
} from '../../shared/cpuparticles/emissionPoints';
import {
  DEFAULT_PREVIEW_SEED,
  lerpParam,
  restartStep,
  sampleParam,
  tintParticle,
  type ParticleCurves,
  type RestartClock,
  type RestartStep,
} from '../../shared/cpuparticles/process';
import { colorAt, colorCount, vector2At, vector2Count } from '../../../resources/shapes/packedElements';
import { degToRad, degToRadf, lerpf, multiplyColor, TAU } from '../../../godot/math/math.js';
import { storedColor, storedReal as f, storedTransform2D, storedVector2 } from '../../../godot/math/real.js';
import {
  TRANSFORM2D_IDENTITY,
  affineInverseTransform2D,
  multiplyTransform2D,
  transform2DBasisXform,
  transform2DXform,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import type { CPUParticles2DProperties } from './types';
import type { Rgba } from '../../../godot/math/math.js';
import {
  normalizedVector2,
  vector2Add,
  vector2Length,
  vector2LengthSquared,
  vector2Scaled,
  vector2Sub,
  type Vector2,
} from '../../../godot/math/vector.js';
import { CPUParticles2DDrawOrder, CPUParticles2DEmissionShape } from '../../../godot/scene/particles2d';
import { CPUParticlesParameter } from '../../../godot/scene/cpuParticles';

/** A particle's `Transform2D`, which the process loop writes in place, as Godot's `Particle`. */
type ParticleTransform = { -readonly [K in keyof Transform2DColumns]: number };

/**
 * Ceiling on settle steps: `preprocess = 100000` would otherwise spin three
 * million iterations before the first paint. Real emitters need tens of steps.
 */
const MAX_SIM_STEPS = 4096;

export interface ParticleSimInput {
  props: CPUParticles2DProperties;
  curves: ParticleCurves;
  /** `scale_curve_x` and `_y`, read only with `split_scale`. */
  scaleCurves: { x: Curve | null; y: Curve | null };
  colorRamp: Gradient | null;
  colorInitialRamp: Gradient | null;
  /**
   * The emitter's world transform in Godot 2D pixel space, used only when
   * `local_coords` is false: Godot spawns in global space and draws with an
   * identity transform, so the pose maps back through this transform's inverse.
   */
  emissionTransform: Transform2DColumns;
}

/** One particle as the renderer needs it: where its quad goes, and its tint. */
export interface RenderedParticle {
  /** Item-local `Transform2D` mapping the texture quad's local corners. */
  transform: Transform2DColumns;
  /** Godot's `p.color`: sRGB, alpha included, curve, ramp and hue applied. */
  color: Rgba;
  /**
   * Godot's `p.custom[2]`, reaching the canvas shader as `INSTANCE_CUSTOM.z`:
   * `anim_offset + age × anim_speed`. A `CanvasItemMaterial` with
   * `particles_animation` turns it into a flipbook cell index.
   */
  anim: number;
  /** `p.time`, in seconds. The `draw_order = Lifetime` sort key. */
  age: number;
  /** The particle's index in the emitter, which is its `draw_order = Index` order. */
  index: number;
}

/** Godot's private `Particle` struct, only the fields the process loop reads. */
interface Particle {
  transform: ParticleTransform;
  color: Rgba;
  custom: [number, number, number, number];
  rotation: number;
  velocity: Vector2;
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

/** Godot's inspector floor for `lifetime`. Its setter rejects anything lower. */
const MIN_LIFETIME = 0.01;

/** The smallest scale Godot draws: a zero-scale quad never collapses the basis. */
const MIN_SCALE = 0.00001;

/**
 * Seconds of settle the frozen pose sits at: the authored `preprocess`, else one
 * lifetime (steady state), halved for a `one_shot` burst to catch it mid-flight.
 * `_update_internal` spends both through one loop (`cpu_particles_2d.cpp:727-738`),
 * so `pnpm ref:godot --particles <seconds>` renders the same instant in Godot.
 */
function settleSeconds(props: CPUParticles2DProperties): number {
  if (props.preprocess > 0) return props.preprocess;
  const lifetime = Math.max(MIN_LIFETIME, props.lifetime);
  return props.one_shot ? lifetime * 0.5 : lifetime;
}

/**
 * Evaluate the emitter to a single pose, in the emitter node's local space and in the order
 * it must be drawn. No clock: a running emitter makes a golden unstable (ADR-0012), and the
 * editor animates on wall clock (`set_process_internal(emitting)`, `cpu_particles_2d.cpp:1262`,
 * no `is_editor_hint` guard), at an instant that no file or reference render can name.
 */
export function simulateFrozenPose(authored: ParticleSimInput): RenderedParticle[] {
  const input = storedInput(authored);
  const { props } = input;
  // `_update_internal` bails before touching the buffer when the emitter is
  // neither active nor emitting, and a scene file cannot make `active` true
  // without `emitting`.
  if (!props.emitting) return [];

  const pcount = props.amount;
  if (pcount < 1) return [];

  const lifetime = Math.max(MIN_LIFETIME, props.lifetime);
  const frameTime = props.fixed_fps > 0 ? 1 / props.fixed_fps : 1 / 30;

  const state: SimState = {
    time: 0,
    cycle: 0,
    emitting: true,
    particles: Array.from({ length: pcount }, newParticle),
    lifetime,
    seed: (props.use_fixed_seed ? props.seed : DEFAULT_PREVIEW_SEED) >>> 0,
    rng: new GodotRandomPCG(0),
    processRng: previewProcessRng(),
    emissionXform: props.local_coords ? TRANSFORM2D_IDENTITY : input.emissionTransform,
  };

  // Godot's settle steps whole frames and the last one overshoots: `while (todo >
  // 0) { _particles_process(frame_time); todo -= frame_time; }`
  // (`cpu_particles_2d.cpp:733-736`), so 1.0 s at 1/30 s is 31 frames, 1.0333 s.
  // `speed_scale` is forced to 1 around the loop (`:732,738`) and never moves the pose.
  let todo = settleSeconds(props);
  for (let step = 0; todo > 0 && step < MAX_SIM_STEPS; step++) {
    particlesProcess(state, input, frameTime);
    todo -= frameTime;
  }

  return collectPose(state, props);
}

/**
 * The input as Godot holds it: every `real_t`, `Vector2`, `Color` and `Transform2D` field stores a
 * float, and the setters round a double a scene file states (`cpu_particles_2d.h:129-174`).
 * `lifetime`, `lifetime_randomness` and `speed_scale` are doubles in Godot and stay so.
 */
function storedInput(input: ParticleSimInput): ParticleSimInput {
  const { props } = input;
  return {
    ...input,
    props: {
      ...props,
      explosiveness: f(props.explosiveness),
      randomness: f(props.randomness),
      spread: f(props.spread),
      direction: storedVector2(props.direction),
      gravity: storedVector2(props.gravity),
      emission_sphere_radius: f(props.emission_sphere_radius),
      emission_rect_extents: storedVector2(props.emission_rect_extents),
      emission_ring_radius: f(props.emission_ring_radius),
      emission_ring_inner_radius: f(props.emission_ring_inner_radius),
      color: storedColor(props.color),
      params: props.params.map((param) => ({ ...param, min: f(param.min), max: f(param.max) })),
    },
    emissionTransform: storedTransform2D(input.emissionTransform),
    colorRamp: input.colorRamp && storedGradient(input.colorRamp),
    colorInitialRamp: input.colorInitialRamp && storedGradient(input.colorInitialRamp),
  };
}

interface SimState {
  time: number;
  cycle: number;
  emitting: boolean;
  particles: Particle[];
  lifetime: number;
  seed: number;
  rng: GodotRandomPCG;
  /** `Math::rand()` and `Math::randf()`, for the POINTS pick and the RING place: see {@link previewProcessRng}. */
  processRng: GodotRandomPCG;
  emissionXform: Transform2DColumns;
}

function newParticle(): Particle {
  return {
    transform: { ...TRANSFORM2D_IDENTITY },
    color: { r: 1, g: 1, b: 1, a: 1 },
    custom: [0, 0, 0, 0],
    rotation: 0,
    velocity: { x: 0, y: 0 },
    active: false,
    angleRand: 0,
    scaleRand: 0,
    hueRotRand: 0,
    animOffsetRand: 0,
    startColorRand: { r: 1, g: 1, b: 1, a: 1 },
    time: 0,
    lifetime: 0,
    baseColor: { r: 1, g: 1, b: 1, a: 1 },
    seed: 0,
  };
}

/**
 * `CPUParticles2D::_particles_process`. Its first line is `p_delta *=
 * speed_scale`, which is absent here because every call site is inside Godot's
 * settle, where `speed_scale` is held at 1.
 */
function particlesProcess(state: SimState, input: ParticleSimInput, delta: number): void {
  const { props } = input;
  const { lifetime } = state;
  const pcount = state.particles.length;

  const prevTime = state.time;
  state.time += delta;
  if (state.time > lifetime) {
    state.time = state.time % lifetime;
    state.cycle++;
    if (props.one_shot && state.cycle > 0) state.emitting = false;
  }

  // A global-coords emitter spawns in world space. `velocity_xform` is the same
  // transform with its translation dropped, since a velocity is a direction.
  const emissionXform = state.emissionXform;
  const velocityXform: Transform2DColumns = { ...emissionXform, tx: 0, ty: 0 };

  const clock: RestartClock = {
    pcount,
    cycle: state.cycle,
    prevTime,
    time: state.time,
    lifetime,
    delta,
    randomness: props.randomness,
    explosiveness: props.explosiveness,
    fractDelta: props.fract_delta,
  };
  const step: RestartStep = { restart: false, localDelta: 0 };

  for (let i = 0; i < pcount; i++) {
    const p = state.particles[i]!;
    if (!state.emitting && !p.active) continue;

    restartStep(clock, i, step);
    const { localDelta } = step;
    const restart = step.restart || p.time * (1.0 - props.explosiveness) > p.lifetime;

    let tv = 0.0;

    if (restart) {
      if (!state.emitting) {
        p.active = false;
        continue;
      }
      restartParticle(state, input, p, i, tv);
      if (!props.local_coords) {
        p.velocity = transform2DXform(velocityXform, p.velocity);
        p.transform = multiplyTransform2D(emissionXform, p.transform);
      }
    } else if (!p.active) {
      continue;
    } else if (particleExpired(p.time, p.lifetime)) {
      p.active = false;
      tv = 1.0;
    } else {
      tv = advanceParticle(state, input, p, localDelta);
    }

    applyAppearance(input, p, tv);

    // Godot integrates position after the appearance pass, and does it on the
    // restart frame too, so a newborn particle is already one step along.
    const displacement = vector2Scaled(p.velocity, f(localDelta));
    p.transform.tx = f(p.transform.tx + displacement.x);
    p.transform.ty = f(p.transform.ty + displacement.y);
  }
}

/**
 * `p.time > p.lifetime` (`cpu_particles_2d.cpp:971`): strict, so a particle
 * exactly at its lifetime gets one more advancing step before it dies.
 */
function particleExpired(time: number, lifetime: number): boolean {
  return time > lifetime;
}

/** The `restart` branch: a fresh draw from the per-particle RNG. */
function restartParticle(
  state: SimState,
  input: ParticleSimInput,
  p: Particle,
  index: number,
  tv: number
): void {
  const { props, curves, colorInitialRamp } = input;

  const angleCurve = curves[CPUParticlesParameter.ANGLE] ?? null;
  const texAngle = angleCurve ? f(sampleCurve(angleCurve, tv)) : 1.0;
  // Godot samples the angle curve for the anim offset too
  // (`cpu_particles_2d.cpp:916-919`), and this reproduces it. Same curve, same
  // `tv`, so it reuses the value rather than a second search.
  const texAnimOffset = texAngle;

  p.active = true;
  p.seed = (state.seed + index + index + state.cycle) >>> 0;
  const rng = state.rng;
  rng.seed(p.seed);

  p.angleRand = rng.randf();
  p.scaleRand = rng.randf();
  p.hueRotRand = rng.randf();
  p.animOffsetRand = rng.randf();

  p.startColorRand = colorInitialRamp
    ? sampleGradientColor(colorInitialRamp, rng.randf())
    : { r: 1, g: 1, b: 1, a: 1 };

  // `(randf * 2.0 - 1.0) * spread` is a double, so `deg_to_rad` takes its double overload.
  const angle1Rad = f(
    f(Math.atan2(props.direction.y, props.direction.x)) + degToRad((rng.randf() * 2.0 - 1.0) * props.spread)
  );
  const direction = { x: f(Math.cos(angle1Rad)), y: f(Math.sin(angle1Rad)) };
  const velocityParam = props.params[CPUParticlesParameter.INITIAL_LINEAR_VELOCITY]!;
  p.velocity = vector2Scaled(direction, lerpf(velocityParam.min, velocityParam.max, rng.randf()));

  const angleParam = props.params[CPUParticlesParameter.ANGLE]!;
  p.rotation = degToRadf(f(texAngle * lerpf(angleParam.min, angleParam.max, p.angleRand)));

  const animOffset = props.params[CPUParticlesParameter.ANIM_OFFSET]!;
  p.custom[0] = 0.0;
  p.custom[1] = 0.0;
  p.custom[2] = f(texAnimOffset * lerpf(animOffset.min, animOffset.max, p.animOffsetRand));
  p.custom[3] = f(1.0 - rng.randf() * props.lifetime_randomness);
  p.transform = { ...TRANSFORM2D_IDENTITY };
  p.time = 0;
  p.lifetime = state.lifetime * p.custom[3];
  p.baseColor = { r: 1, g: 1, b: 1, a: 1 };

  emitAtShape(props, state, p);
}

/** The emission-shape offset (`cpu_particles_2d.cpp:912-962`). */
function emitAtShape(props: CPUParticles2DProperties, state: SimState, p: Particle): void {
  const { rng } = state;
  switch (props.emission_shape) {
    case CPUParticles2DEmissionShape.SPHERE: {
      const t = f(TAU * rng.randf());
      const radius = f(props.emission_sphere_radius * rng.randf());
      p.transform.tx = f(f(Math.cos(t)) * radius);
      p.transform.ty = f(f(Math.sin(t)) * radius);
      break;
    }
    case CPUParticles2DEmissionShape.SPHERE_SURFACE: {
      const s = rng.randf();
      const t = f(TAU * rng.randf());
      // `1.0 - s * s` mixes a double with a float product, so the root is a double.
      const radius = f(props.emission_sphere_radius * Math.sqrt(1.0 - f(s * s)));
      p.transform.tx = f(f(Math.cos(t)) * radius);
      p.transform.ty = f(f(Math.sin(t)) * radius);
      break;
    }
    case CPUParticles2DEmissionShape.RECTANGLE: {
      // One `Vector2(rng->randf() …, rng->randf() …)` call, and C++ leaves the
      // argument order unspecified. Measured on Godot 4.6.3: particle 0 lands at
      // (+44.5, +9.3), the y-first draw. The x-first reading gives (+25.4, +16.9).
      const y = f(rng.randf() * 2.0 - 1.0);
      const x = f(rng.randf() * 2.0 - 1.0);
      p.transform.tx = f(x * props.emission_rect_extents.x);
      p.transform.ty = f(y * props.emission_rect_extents.y);
      break;
    }
    case CPUParticles2DEmissionShape.POINTS:
    case CPUParticles2DEmissionShape.DIRECTED_POINTS:
      emitAtPoint(props, state, p);
      break;
    case CPUParticles2DEmissionShape.RING:
      emitOnRing(props, state.processRng, p);
      break;
    default:
      // POINT emits from the origin, which `restartParticle` sets before the switch.
      break;
  }
}

/**
 * Places `p` on one of `emission_points`, turns a DIRECTED_POINTS velocity along that point's
 * normal, and takes its colour, each only when every point has one (`:929-950`).
 */
function emitAtPoint(props: CPUParticles2DProperties, state: SimState, p: Particle): void {
  const count = vector2Count(props.emission_points);
  const index = pickPoint(state.processRng, count);
  if (index === null) return;
  const point = vector2At(props.emission_points, index);
  p.transform.tx = point.x;
  p.transform.ty = point.y;
  const isDirected = props.emission_shape === CPUParticles2DEmissionShape.DIRECTED_POINTS;
  if (isDirected && vector2Count(props.emission_normals) === count)
    p.velocity = turnedByNormal(vector2At(props.emission_normals, index), p.velocity);
  if (colorCount(props.emission_colors) === count) p.baseColor = colorAt(props.emission_colors, index);
}

/** A place in the ring, from two draws of Godot's process-wide `Math::randf()` (`:952-957`). */
function emitOnRing(props: CPUParticles2DProperties, processRng: GodotRandomPCG, p: Particle): void {
  const t = f(TAU * processRandf(processRng));
  const outerSquared = f(props.emission_ring_radius * props.emission_ring_radius);
  const innerSquared = f(props.emission_ring_inner_radius * props.emission_ring_inner_radius);
  const radius = f(Math.sqrt(f(f(processRandf(processRng) * f(outerSquared - innerSquared)) + innerSquared)));
  p.transform.tx = f(f(Math.cos(t)) * radius);
  p.transform.ty = f(f(Math.sin(t)) * radius);
}

/** The alive branch: integrate one step, returning the normalised age `tv`. */
function advanceParticle(state: SimState, input: ParticleSimInput, p: Particle, localDelta: number): number {
  const { props, curves } = input;
  const seedRef: SeedRef = { value: p.seed };

  p.time += localDelta;
  p.custom[1] = f(p.time / state.lifetime);
  const tv = f(p.time / p.lifetime);

  const texLinearVelocity = sampleParam(curves, CPUParticlesParameter.INITIAL_LINEAR_VELOCITY, tv);
  const texOrbitVelocity = sampleParam(curves, CPUParticlesParameter.ORBIT_VELOCITY, tv);
  const texAngularVelocity = sampleParam(curves, CPUParticlesParameter.ANGULAR_VELOCITY, tv);
  const texLinearAccel = sampleParam(curves, CPUParticlesParameter.LINEAR_ACCEL, tv);
  const texTangentialAccel = sampleParam(curves, CPUParticlesParameter.TANGENTIAL_ACCEL, tv);
  const texRadialAccel = sampleParam(curves, CPUParticlesParameter.RADIAL_ACCEL, tv);
  const texDamping = sampleParam(curves, CPUParticlesParameter.DAMPING, tv);
  const texAngle = sampleParam(curves, CPUParticlesParameter.ANGLE, tv);
  const texAnimSpeed = sampleParam(curves, CPUParticlesParameter.ANIM_SPEED, tv);
  const texAnimOffset = sampleParam(curves, CPUParticlesParameter.ANIM_OFFSET, tv);

  const force: Vector2 = { x: props.gravity.x, y: props.gravity.y };

  // Each of the three accelerations sits behind a C++ ternary, so its
  // `rand_from_seed` draw is consumed only when the branch is taken. Drawing
  // unconditionally would desynchronise every later value in the same step.
  if (vector2LengthSquared(p.velocity) > 0) {
    const accel = lerpParam(props.params, CPUParticlesParameter.LINEAR_ACCEL, seedRef);
    addAcceleration(force, normalizedVector2(p.velocity), texLinearAccel, accel);
  }

  // Radial and tangential acceleration are both measured from the emitter's
  // own origin, which for a global-coords emitter is its world position.
  const diff: Vector2 = {
    x: f(p.transform.tx - state.emissionXform.tx),
    y: f(p.transform.ty - state.emissionXform.ty),
  };
  if (vector2LengthSquared(diff) > 0) {
    const radial = lerpParam(props.params, CPUParticlesParameter.RADIAL_ACCEL, seedRef);
    const outward = normalizedVector2(diff);
    addAcceleration(force, outward, texRadialAccel, radial);

    // `yx * Vector2(-1, 1)` is `(-diff.y, diff.x)`, the perpendicular Godot spins tangential
    // acceleration around. It has `diff`'s length, so its unit vector is `outward` turned.
    const tangential = lerpParam(props.params, CPUParticlesParameter.TANGENTIAL_ACCEL, seedRef);
    // `direction * (tex_tangential_accel * lerp)`: one product, not two.
    addAcceleration(force, { x: -outward.y, y: outward.x }, 1, f(texTangentialAccel * tangential));
  }

  const delta = f(localDelta);
  p.velocity.x = f(p.velocity.x + f(force.x * delta));
  p.velocity.y = f(p.velocity.y + f(force.y * delta));

  const orbitAmount = f(
    texOrbitVelocity * lerpParam(props.params, CPUParticlesParameter.ORBIT_VELOCITY, seedRef)
  );
  if (orbitAmount !== 0.0) {
    // Godot rotates by -ang to match ParticleProcessMaterial's clockwise matrix.
    const ang = f(orbitAmount * localDelta * TAU);
    const cr = f(Math.cos(-ang));
    const sr = f(Math.sin(-ang));
    const rotation = { a: cr, b: sr, c: -sr, d: cr, tx: 0, ty: 0 };
    const orbited = vector2Add(
      vector2Sub({ x: p.transform.tx, y: p.transform.ty }, diff),
      transform2DBasisXform(rotation, diff)
    );
    p.transform.tx = orbited.x;
    p.transform.ty = orbited.y;
  }

  if (curves[CPUParticlesParameter.INITIAL_LINEAR_VELOCITY]) {
    // With a velocity curve, the speed is the curve, not an acceleration.
    p.velocity = vector2Scaled(normalizedVector2(p.velocity), texLinearVelocity);
  }

  if (f(props.params[CPUParticlesParameter.DAMPING]!.max + texDamping) > 0.0) {
    const damp = f(texDamping * lerpParam(props.params, CPUParticlesParameter.DAMPING, seedRef));
    const length = vector2Length(p.velocity);
    // `damp * local_delta` is a double, so the subtraction runs in double and rounds once.
    const speed = f(length - damp * localDelta);
    // `normalized() * v`: the unit vector divides by the length measured above, and is zero for none.
    p.velocity =
      speed < 0.0 || length === 0
        ? { x: 0, y: 0 }
        : { x: f(f(p.velocity.x / length) * speed), y: f(f(p.velocity.y / length) * speed) };
  }

  const angleParam = props.params[CPUParticlesParameter.ANGLE]!;
  let baseAngle = f(texAngle * lerpf(angleParam.min, angleParam.max, p.angleRand));
  baseAngle = f(
    baseAngle +
      p.custom[1] *
        state.lifetime *
        texAngularVelocity *
        lerpParam(props.params, CPUParticlesParameter.ANGULAR_VELOCITY, seedRef)
  );
  p.rotation = degToRadf(baseAngle);

  const animOffset = props.params[CPUParticlesParameter.ANIM_OFFSET]!;
  const offset = f(texAnimOffset * lerpf(animOffset.min, animOffset.max, p.animOffsetRand));
  const progress = f(
    f(tv * texAnimSpeed) * lerpParam(props.params, CPUParticlesParameter.ANIM_SPEED, seedRef)
  );
  p.custom[2] = f(offset + progress);

  return tv;
}

/**
 * `force += direction * texture * random` (`cpu_particles_2d.cpp:1004-1020`), each product and the
 * sum rounded as C++ rounds a `Vector2` of floats. `force` is the caller's own to change.
 */
function addAcceleration(force: Vector2, direction: Vector2, texture: number, random: number): void {
  force.x = f(force.x + f(f(direction.x * texture) * random));
  force.y = f(force.y + f(f(direction.y * texture) * random));
}

/** Scale, colour, hue rotation and the quad's basis, run for every particle. */
function applyAppearance(input: ParticleSimInput, p: Particle, tv: number): void {
  const { props, curves, colorRamp } = input;

  const texScale = sampledScale(input, tv);

  const hueCurve = curves[CPUParticlesParameter.HUE_VARIATION] ?? null;
  // Unlike every other slot this one defaults to 0, not 1: with no curve there
  // is no hue rotation at all.
  const texHueVariation = hueCurve ? f(sampleCurve(hueCurve, tv)) : 0.0;

  const hueParam = props.params[CPUParticlesParameter.HUE_VARIATION]!;
  const hueRotAngle = f(texHueVariation * TAU * lerpf(hueParam.min, hueParam.max, p.hueRotRand));

  const base = colorRamp ? multiplyColor(sampleGradientColor(colorRamp, tv), props.color) : props.color;
  // `cpu_particles_2d.cpp:1090-1126` tints as 3D does.
  tintParticle(p, base, hueRotAngle);

  if (props.particle_flag_align_y) {
    const yAxis = normalizedVector2(
      vector2LengthSquared(p.velocity) > 0 ? p.velocity : { x: p.transform.c, y: p.transform.d }
    );
    p.transform.c = yAxis.x;
    p.transform.d = yAxis.y;
    // Vector2::orthogonal() is (y, -x).
    p.transform.a = yAxis.y;
    p.transform.b = -yAxis.x;
  } else {
    const cos = f(Math.cos(p.rotation));
    const sin = f(Math.sin(p.rotation));
    p.transform.a = cos;
    p.transform.b = -sin;
    p.transform.c = sin;
    p.transform.d = cos;
  }

  const scaleParam = props.params[CPUParticlesParameter.SCALE]!;
  const drawn = lerpf(scaleParam.min, scaleParam.max, p.scaleRand);
  const scaleX = atLeastMinScale(f(texScale.x * drawn));
  const scaleY = atLeastMinScale(f(texScale.y * drawn));
  p.transform.a = f(p.transform.a * scaleX);
  p.transform.b = f(p.transform.b * scaleX);
  p.transform.c = f(p.transform.c * scaleY);
  p.transform.d = f(p.transform.d * scaleY);
}

function atLeastMinScale(axis: number): number {
  return axis < MIN_SCALE ? f(MIN_SCALE) : axis;
}

/** A curve's value at `tv`, or 1 for none: the neutral factor (`cpu_particles_2d.cpp:1075-1093`). */
function sampleOrOne(curve: Curve | null | undefined, tv: number): number {
  return curve ? f(sampleCurve(curve, tv)) : 1.0;
}

/** `tex_scale`: the per-axis curves with `split_scale`, else the one curve on both axes. */
function sampledScale(input: ParticleSimInput, tv: number): { x: number; y: number } {
  if (input.props.split_scale) {
    return { x: sampleOrOne(input.scaleCurves.x, tv), y: sampleOrOne(input.scaleCurves.y, tv) };
  }
  const scale = sampleOrOne(input.curves[CPUParticlesParameter.SCALE], tv);
  return { x: scale, y: scale };
}

/**
 * `_update_particle_data_buffer`: the live particles in draw order, mapped back
 * into the emitter node's local space.
 */
function collectPose(state: SimState, props: CPUParticles2DProperties): RenderedParticle[] {
  const inverse = affineInverseTransform2D(state.emissionXform);

  const order = state.particles.map((_, index) => index);
  if (props.draw_order === CPUParticles2DDrawOrder.LIFETIME) {
    // SortLifetime compares `time > time`, so oldest first.
    order.sort((a, b) => state.particles[b]!.time - state.particles[a]!.time);
  }

  const pose: RenderedParticle[] = [];
  for (const index of order) {
    const p = state.particles[index]!;
    // Godot zeroes an inactive particle's transform, collapsing its quad to a
    // point. Omitting it draws the same nothing for a fraction of the vertices.
    if (!p.active) continue;
    pose.push({
      transform: multiplyTransform2D(inverse, p.transform),
      color: p.color,
      anim: p.custom[2],
      age: p.time,
      index,
    });
  }
  return pose;
}
