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

import type { Color, Vector2 } from '../../base/node2d/types';
import type { Curve } from '../../../resources/curves/curve/types';
import { sampleCurve } from '../../../resources/curves/curve/sample';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
// The pure `Gradient::get_color_at_offset` port, so no renderer enters the import closure.
import { sampleGradientColor } from '../../../resources/textures/gradienttexture2d/sample';
import { GodotRandomPCG, idhash, randFromSeed, type SeedRef } from './godotRng';
import {
  TRANSFORM2D_IDENTITY,
  multiplyTransform2D,
  type Transform2DColumns,
} from '../../../godot/transform2d.js';
import {
  CPUParticles2DDrawOrder,
  CPUParticles2DEmissionShape,
  CPUParticles2DParam,
  type CPUParticles2DProperties,
} from './types';

/** A particle's `Transform2D`, which the process loop writes in place, as Godot's `Particle`. */
type ParticleTransform = { -readonly [K in keyof Transform2DColumns]: number };

/**
 * The seed substituted when a scene does not set `use_fixed_seed`. Godot uses
 * `Math::rand()`, randomised in the constructor and unserialised, so any constant
 * is as faithful as another, and a constant makes this render byte-stable.
 */
export const DEFAULT_PREVIEW_SEED = 0;

/**
 * Ceiling on settle steps: `preprocess = 100000` would otherwise spin three
 * million iterations before the first paint. Real emitters need tens of steps.
 */
export const MAX_SIM_STEPS = 4096;

/** Godot's `Curve` slots, indexed by `CPUParticles2DParam`. Null where unset. */
export type ParticleCurves = ReadonlyArray<Curve | null>;

export interface ParticleSimInput {
  props: CPUParticles2DProperties;
  curves: ParticleCurves;
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
  color: Color;
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
  color: Color;
  custom: [number, number, number, number];
  rotation: number;
  velocity: Vector2;
  active: boolean;
  angleRand: number;
  scaleRand: number;
  hueRotRand: number;
  animOffsetRand: number;
  startColorRand: Color;
  time: number;
  lifetime: number;
  baseColor: Color;
  seed: number;
}

/** Godot's inspector floor for `lifetime`. Its setter rejects anything lower. */
const MIN_LIFETIME = 0.01;

/**
 * Seconds of settle the frozen pose sits at: the authored `preprocess`, else one
 * lifetime (steady state), halved for a `one_shot` burst to catch it mid-flight.
 * `_update_internal` spends both through one loop (`cpu_particles_2d.cpp:727-738`),
 * so `pnpm ref:godot --particles <seconds>` renders the same instant in Godot.
 */
export function settleSeconds(props: CPUParticles2DProperties): number {
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
export function simulateFrozenPose(input: ParticleSimInput): RenderedParticle[] {
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

interface SimState {
  time: number;
  cycle: number;
  emitting: boolean;
  particles: Particle[];
  lifetime: number;
  seed: number;
  rng: GodotRandomPCG;
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

  const systemPhase = state.time / lifetime;

  for (let i = 0; i < pcount; i++) {
    const p = state.particles[i]!;
    if (!state.emitting && !p.active) continue;

    // Particle i is born i/pcount of the way through each cycle, so a continuous
    // emitter shows every age at once.
    let restartPhase = i / pcount;

    if (props.randomness > 0) {
      let hashSeed = state.cycle >>> 0;
      if (restartPhase >= systemPhase) hashSeed = (hashSeed - 1) >>> 0;
      hashSeed = Math.imul(hashSeed, pcount) >>> 0;
      hashSeed = (hashSeed + i) >>> 0;
      const random = (idhash(hashSeed) % 65536) / 65536.0;
      restartPhase += (props.randomness * random * 1.0) / pcount;
    }

    // Explosiveness squeezes every birth phase toward 0, so at 1 the whole
    // emitter fires at once.
    restartPhase *= 1.0 - props.explosiveness;
    const restartTime = restartPhase * lifetime;

    const step = restartStep(prevTime, state.time, restartTime, lifetime, delta, props.fract_delta);
    let restart = step.restart;
    const localDelta = step.localDelta;

    if (p.time * (1.0 - props.explosiveness) > p.lifetime) restart = true;

    let tv = 0.0;

    if (restart) {
      if (!state.emitting) {
        p.active = false;
        continue;
      }
      restartParticle(state, input, p, i, tv);
      if (!props.local_coords) {
        p.velocity = basisXform(velocityXform, p.velocity);
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
    p.transform.tx += p.velocity.x * localDelta;
    p.transform.ty += p.velocity.y * localDelta;
  }
}

/** Whether particle `i` restarts this step, and the delta its position integrates with. */
export interface RestartStep {
  restart: boolean;
  /** `local_delta`: the whole step unless a restart shortens it (fract_delta). */
  localDelta: number;
}

/**
 * Whether particle `i` restarts this step, and its `local_delta`
 * (`cpu_particles_2d.cpp:807,829-852`). With `fractionalDelta` (`fract_delta`,
 * default true) a particle born mid-step gets only the remainder after its restart
 * instant, so same-step births spread into a bar instead of one displacement.
 * @param prevTime The emitter's cycle time before this step.
 * @param time The cycle time after this step, wrapped mod `lifetime`.
 * @param restartTime `restartPhase * lifetime` for this particle.
 */
export function restartStep(
  prevTime: number,
  time: number,
  restartTime: number,
  lifetime: number,
  delta: number,
  fractionalDelta: boolean
): RestartStep {
  let restart = false;
  let localDelta = delta;

  if (time > prevTime) {
    // restartTime >= prevTime is used so particles emit in the first frame
    // they are processed (`:830`).
    if (restartTime >= prevTime && restartTime < time) {
      restart = true;
      if (fractionalDelta) localDelta = time - restartTime;
    }
  } else if (delta > 0.0) {
    // The step wrapped past `lifetime`. A restart near the tail of the cycle gets
    // the slice up to the old boundary plus `time`, and one right after zero
    // gets the ordinary slice.
    if (restartTime >= prevTime) {
      restart = true;
      if (fractionalDelta) localDelta = lifetime - restartTime + time;
    } else if (restartTime < time) {
      restart = true;
      if (fractionalDelta) localDelta = time - restartTime;
    }
  }

  return { restart, localDelta };
}

/**
 * `p.time > p.lifetime` (`cpu_particles_2d.cpp:971`): strict, so a particle
 * exactly at its lifetime gets one more advancing step before it dies.
 */
export function particleExpired(time: number, lifetime: number): boolean {
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

  const angleCurve = curves[CPUParticles2DParam.Angle] ?? null;
  const texAngle = angleCurve ? sampleCurve(angleCurve, tv) : 1.0;
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

  const angle1Rad =
    Math.atan2(props.direction.y, props.direction.x) +
    degToRad((rng.randf() * 2.0 - 1.0) * props.spread);
  const speed = lerp(
    props.params[CPUParticles2DParam.InitialLinearVelocity]!.min,
    props.params[CPUParticles2DParam.InitialLinearVelocity]!.max,
    rng.randf()
  );
  p.velocity = { x: Math.cos(angle1Rad) * speed, y: Math.sin(angle1Rad) * speed };

  const angleParam = props.params[CPUParticles2DParam.Angle]!;
  p.rotation = degToRad(texAngle * lerp(angleParam.min, angleParam.max, p.angleRand));

  const animOffset = props.params[CPUParticles2DParam.AnimOffset]!;
  p.custom[0] = 0.0;
  p.custom[1] = 0.0;
  p.custom[2] = texAnimOffset * lerp(animOffset.min, animOffset.max, p.animOffsetRand);
  p.custom[3] = 1.0 - rng.randf() * props.lifetime_randomness;
  p.transform = { ...TRANSFORM2D_IDENTITY };
  p.time = 0;
  p.lifetime = state.lifetime * p.custom[3];
  p.baseColor = { r: 1, g: 1, b: 1, a: 1 };

  emitAtShape(props, p, rng);
}

/**
 * The emission-shape offset. POINTS / DIRECTED_POINTS / RING draw from Godot's
 * unserialised global RNG (`cpu_particles_2d.cpp:975, 992, 995`), so no frozen
 * pose can match them, and the linter reports them instead.
 */
function emitAtShape(props: CPUParticles2DProperties, p: Particle, rng: GodotRandomPCG): void {
  switch (props.emission_shape) {
    case CPUParticles2DEmissionShape.Sphere: {
      const t = 2 * Math.PI * rng.randf();
      const radius = props.emission_sphere_radius * rng.randf();
      p.transform.tx = Math.cos(t) * radius;
      p.transform.ty = Math.sin(t) * radius;
      break;
    }
    case CPUParticles2DEmissionShape.SphereSurface: {
      const s = rng.randf();
      const t = 2 * Math.PI * rng.randf();
      const radius = props.emission_sphere_radius * Math.sqrt(1.0 - s * s);
      p.transform.tx = Math.cos(t) * radius;
      p.transform.ty = Math.sin(t) * radius;
      break;
    }
    case CPUParticles2DEmissionShape.Rectangle: {
      // One `Vector2(rng->randf() …, rng->randf() …)` call, and C++ leaves the
      // argument order unspecified. Measured on Godot 4.6.3: particle 0 lands at
      // (+44.5, +9.3), the y-first draw. The x-first reading gives (+25.4, +16.9).
      const y = rng.randf();
      const x = rng.randf();
      p.transform.tx = (x * 2.0 - 1.0) * props.emission_rect_extents.x;
      p.transform.ty = (y * 2.0 - 1.0) * props.emission_rect_extents.y;
      break;
    }
    default:
      // Point, and the three unpreviewable shapes, all leave the origin alone.
      break;
  }
}

/** The alive branch: integrate one step, returning the normalised age `tv`. */
function advanceParticle(
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
  const pos: Vector2 = { x: p.transform.tx, y: p.transform.ty };

  // Each of the three accelerations sits behind a C++ ternary, so its
  // `rand_from_seed` draw is consumed only when the branch is taken. Drawing
  // unconditionally would desynchronise every later value in the same step.
  const speed = Math.hypot(p.velocity.x, p.velocity.y);
  if (speed > 0) {
    const accel = texLinearAccel * lerpParam(props, CPUParticles2DParam.LinearAccel, seedRef);
    force.x += (p.velocity.x / speed) * accel;
    force.y += (p.velocity.y / speed) * accel;
  }

  // Radial and tangential acceleration are both measured from the emitter's
  // own origin, which for a global-coords emitter is its world position.
  const diff: Vector2 = { x: pos.x - state.emissionXform.tx, y: pos.y - state.emissionXform.ty };
  const diffLength = Math.hypot(diff.x, diff.y);
  if (diffLength > 0) {
    const radial = texRadialAccel * lerpParam(props, CPUParticles2DParam.RadialAccel, seedRef);
    force.x += (diff.x / diffLength) * radial;
    force.y += (diff.y / diffLength) * radial;
  }

  // `yx` is `(diff.y, diff.x)` mirrored in X: the perpendicular Godot spins
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
    p.transform.tx += -diff.x + (cr * diff.x - sr * diff.y);
    p.transform.ty += -diff.y + (sr * diff.x + cr * diff.y);
  }

  if (curves[CPUParticles2DParam.InitialLinearVelocity]) {
    // With a velocity curve, the speed is the curve, not an acceleration.
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

/** Scale, colour, hue rotation and the quad's basis, run for every particle. */
function applyAppearance(input: ParticleSimInput, p: Particle, tv: number): void {
  const { props, curves, colorRamp } = input;

  const scaleCurve = curves[CPUParticles2DParam.Scale] ?? null;
  const texScale = scaleCurve ? sampleCurve(scaleCurve, tv) : 1.0;

  const hueCurve = curves[CPUParticles2DParam.HueVariation] ?? null;
  // Unlike every other slot this one defaults to 0, not 1: with no curve there
  // is no hue rotation at all.
  const texHueVariation = hueCurve ? sampleCurve(hueCurve, tv) : 0.0;

  const hueParam = props.params[CPUParticles2DParam.HueVariation]!;
  const hueRotAngle =
    texHueVariation * 2 * Math.PI * lerp(hueParam.min, hueParam.max, p.hueRotRand);

  const base = colorRamp
    ? multiplyColor(sampleGradientColor(colorRamp, tv), props.color)
    : { ...props.color };
  // Called unconditionally, not short-circuited at angle 0: Godot's basis is not
  // quite the identity there. The blue column comes out at -0.001/-0.001/1, so
  // every particle takes a slight tint.
  const rotated = rotateHue(base, hueRotAngle);

  p.color = multiplyColor(multiplyColor(rotated, p.baseColor), p.startColorRand);

  if (props.particle_flag_align_y) {
    let yAxis: Vector2 =
      Math.hypot(p.velocity.x, p.velocity.y) > 0
        ? { x: p.velocity.x, y: p.velocity.y }
        : { x: p.transform.c, y: p.transform.d };
    const length = Math.hypot(yAxis.x, yAxis.y);
    yAxis = length > 0 ? { x: yAxis.x / length, y: yAxis.y / length } : { x: 0, y: 0 };
    p.transform.c = yAxis.x;
    p.transform.d = yAxis.y;
    // Vector2::orthogonal() is (y, -x).
    p.transform.a = yAxis.y;
    p.transform.b = -yAxis.x;
  } else {
    p.transform.a = Math.cos(p.rotation);
    p.transform.b = -Math.sin(p.rotation);
    p.transform.c = Math.sin(p.rotation);
    p.transform.d = Math.cos(p.rotation);
  }

  const scaleParam = props.params[CPUParticles2DParam.Scale]!;
  const amount = lerp(scaleParam.min, scaleParam.max, p.scaleRand);
  // Godot floors the scale so a zero-scale quad never collapses the basis.
  const scaleX = Math.max(0.00001, texScale * amount);
  const scaleY = Math.max(0.00001, texScale * amount);
  p.transform.a *= scaleX;
  p.transform.b *= scaleX;
  p.transform.c *= scaleY;
  p.transform.d *= scaleY;
}

/**
 * `_update_particle_data_buffer`: the live particles in draw order, mapped back
 * into the emitter node's local space.
 */
function collectPose(state: SimState, props: CPUParticles2DProperties): RenderedParticle[] {
  const inverse = affineInverse(state.emissionXform);

  const order = state.particles.map((_, index) => index);
  if (props.draw_order === CPUParticles2DDrawOrder.Lifetime) {
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

function lerp(from: number, to: number, weight: number): number {
  return from + (to - from) * weight;
}

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function multiplyColor(a: Color, b: Color): Color {
  return { r: a.r * b.r, g: a.g * b.g, b: a.b * b.b, a: a.a * b.a };
}

/**
 * Godot's YIQ-style hue rotation: three constant bases blended by cos/sin of the
 * angle, then applied with `Basis::xform_inv`, the transpose.
 */
function rotateHue(color: Color, angle: number): Color {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  // The three luminance constants each basis row is built from.
  const lr = 0.299;
  const lg = 0.587;
  const lb = 0.114;

  // Columns of the blended basis: with the transpose, each output channel reads
  // down a column, not across a row.
  const xr = lr + 0.701 * c + 0.168 * s;
  const xg = lg + -0.587 * c + 0.33 * s;
  const xb = lb + -0.114 * c + -0.497 * s;

  const yr = lr + -0.299 * c + -0.328 * s;
  const yg = lg + 0.413 * c + 0.035 * s;
  const yb = lb + -0.114 * c + 0.292 * s;

  const zr = lr + -0.3 * c + 1.25 * s;
  const zg = lg + -0.588 * c + -1.05 * s;
  const zb = lb + 0.886 * c + -0.203 * s;

  return {
    r: xr * color.r + yr * color.g + zr * color.b,
    g: xg * color.r + yg * color.g + zg * color.b,
    b: xb * color.r + yb * color.g + zb * color.b,
    a: color.a,
  };
}

/** `Transform2D::basis_xform`: the linear part only. */
function basisXform(t: Transform2DColumns, v: Vector2): Vector2 {
  return { x: t.a * v.x + t.c * v.y, y: t.b * v.x + t.d * v.y };
}

/**
 * `Transform2D::affine_inverse`. A singular transform (a node scaled to zero) has
 * no inverse, and Godot's `ERR_FAIL_COND` leaves the matrix untouched, so this
 * answers the identity, not NaN.
 */
function affineInverse(t: Transform2DColumns): Transform2DColumns {
  const det = t.a * t.d - t.b * t.c;
  if (det === 0 || !Number.isFinite(det)) return TRANSFORM2D_IDENTITY;
  const idet = 1 / det;
  const a = t.d * idet;
  const b = -t.b * idet;
  const c = -t.c * idet;
  const d = t.a * idet;
  return { a, b, c, d, tx: -(a * t.tx + c * t.ty), ty: -(b * t.tx + d * t.ty) };
}
