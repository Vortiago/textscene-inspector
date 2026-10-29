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

import type { Curve } from '../../../resources/curves/curve/types';
import { sampleCurve } from '../../../resources/curves/curve/sample';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
// The pure `Gradient::get_color_at_offset` port, so no renderer enters the import closure.
import { sampleGradientColor } from '../../../resources/textures/gradienttexture2d/sample';
import { GodotRandomPCG, idhash, randFromSeed, type SeedRef } from './godotRng';
import { degToRad, degToRadf, lerpf, TAU } from '../../../godot/math/math.js';
import { storedReal as f, storedTransform2D, storedVector2 } from '../../../godot/math/real.js';
import {
  TRANSFORM2D_IDENTITY,
  affineInverseTransform2Df,
  multiplyTransform2Df,
  transform2DXformf,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import { type CPUParticles2DProperties } from './types';
import type { Rgba } from '../../../godot/math/math.js';
import {
  normalizedVector2,
  vector2Add,
  vector2Length,
  vector2Scale,
  vector2Sub,
  type Vector2,
} from '../../../godot/math/vector.js';
import { CPUParticles2DDrawOrder, CPUParticles2DEmissionShape } from '../../../godot/scene/particles2d';
import { CPUParticlesParameter } from '../../../godot/scene/cpuParticles';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/** A particle's `Transform2D`, which the process loop writes in place, as Godot's `Particle`. */
type ParticleTransform = { -readonly [K in keyof Transform2DColumns]: number };

/**
 * The seed substituted when a scene does not set `use_fixed_seed`. Godot uses
 * `Math::rand()`, randomised in the constructor and unserialised, so any constant
 * is as faithful as another, and a constant makes this render byte-stable.
 */
const DEFAULT_PREVIEW_SEED = 0;

/**
 * Ceiling on settle steps: `preprocess = 100000` would otherwise spin three
 * million iterations before the first paint. Real emitters need tens of steps.
 */
const MAX_SIM_STEPS = 4096;

/** Godot's `Curve` slots, indexed by `CPUParticlesParameter`. Null where unset. */
type ParticleCurves = ReadonlyArray<Curve | null>;

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
      color: { r: f(props.color.r), g: f(props.color.g), b: f(props.color.b), a: f(props.color.a) },
      params: props.params.map((param) => ({ ...param, min: f(param.min), max: f(param.max) })),
    },
    emissionTransform: storedTransform2D(input.emissionTransform),
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
        p.velocity = transform2DXformf(velocityXform, p.velocity);
        p.transform = multiplyTransform2Df(emissionXform, p.transform);
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
    const displacement = vector2Scale(p.velocity, localDelta);
    p.transform.tx = f(p.transform.tx + displacement.x);
    p.transform.ty = f(p.transform.ty + displacement.y);
  }
}

/** Whether particle `i` restarts this step, and the delta its position integrates with. */
interface RestartStep {
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
function restartStep(
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
  p.velocity = vector2Scale(direction, lerpf(velocityParam.min, velocityParam.max, rng.randf()));

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

  emitAtShape(props, p, rng);
}

/**
 * The emission-shape offset. POINTS / DIRECTED_POINTS / RING draw from Godot's
 * unserialised global RNG (`cpu_particles_2d.cpp:975, 992, 995`), so no frozen
 * pose can match them, and the linter reports them instead.
 */
function emitAtShape(props: CPUParticles2DProperties, p: Particle, rng: GodotRandomPCG): void {
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
    default:
      // Point, and the three unpreviewable shapes, all leave the origin alone.
      break;
  }
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

  let force: Vector2 = props.gravity;
  const pos: Vector2 = { x: p.transform.tx, y: p.transform.ty };

  // Each of the three accelerations sits behind a C++ ternary, so its
  // `rand_from_seed` draw is consumed only when the branch is taken. Drawing
  // unconditionally would desynchronise every later value in the same step.
  if (vector2Length(p.velocity) > 0) {
    const accel = lerpParam(props, CPUParticlesParameter.LINEAR_ACCEL, seedRef);
    const along = vector2Scale(normalizedVector2(p.velocity), texLinearAccel);
    force = vector2Add(force, vector2Scale(along, accel));
  }

  // Radial and tangential acceleration are both measured from the emitter's
  // own origin, which for a global-coords emitter is its world position.
  const diff = vector2Sub(pos, { x: state.emissionXform.tx, y: state.emissionXform.ty });
  const hasDiff = vector2Length(diff) > 0;
  if (hasDiff) {
    const radial = lerpParam(props, CPUParticlesParameter.RADIAL_ACCEL, seedRef);
    const away = vector2Scale(normalizedVector2(diff), texRadialAccel);
    force = vector2Add(force, vector2Scale(away, radial));
  }

  // `yx * Vector2(-1, 1)` is `(-diff.y, diff.x)`: the perpendicular Godot spins
  // tangential acceleration around. Its length is `diff`'s.
  if (hasDiff) {
    const tangential = f(
      texTangentialAccel * lerpParam(props, CPUParticlesParameter.TANGENTIAL_ACCEL, seedRef)
    );
    force = vector2Add(force, vector2Scale(normalizedVector2({ x: -diff.y, y: diff.x }), tangential));
  }

  p.velocity = vector2Add(p.velocity, vector2Scale(force, localDelta));

  const orbitAmount = f(texOrbitVelocity * lerpParam(props, CPUParticlesParameter.ORBIT_VELOCITY, seedRef));
  if (orbitAmount !== 0.0) {
    // Godot rotates by -ang to match ParticleProcessMaterial's clockwise matrix.
    const ang = f(orbitAmount * localDelta * TAU);
    const cr = f(Math.cos(-ang));
    const sr = f(Math.sin(-ang));
    const rotation = { a: cr, b: sr, c: -sr, d: cr, tx: 0, ty: 0 };
    const orbited = vector2Add(vector2Sub(pos, diff), transform2DXformf(rotation, diff));
    p.transform.tx = orbited.x;
    p.transform.ty = orbited.y;
  }

  if (curves[CPUParticlesParameter.INITIAL_LINEAR_VELOCITY]) {
    // With a velocity curve, the speed is the curve, not an acceleration.
    p.velocity = vector2Scale(normalizedVector2(p.velocity), texLinearVelocity);
  }

  if (f(props.params[CPUParticlesParameter.DAMPING]!.max + texDamping) > 0.0) {
    const damp = f(texDamping * lerpParam(props, CPUParticlesParameter.DAMPING, seedRef));
    // `damp * local_delta` is a double, so the subtraction runs in double and rounds once.
    const speed = f(vector2Length(p.velocity) - damp * localDelta);
    p.velocity = speed < 0.0 ? { x: 0, y: 0 } : vector2Scale(normalizedVector2(p.velocity), speed);
  }

  const angleParam = props.params[CPUParticlesParameter.ANGLE]!;
  let baseAngle = f(texAngle * lerpf(angleParam.min, angleParam.max, p.angleRand));
  baseAngle = f(
    baseAngle +
      p.custom[1] *
        state.lifetime *
        texAngularVelocity *
        lerpParam(props, CPUParticlesParameter.ANGULAR_VELOCITY, seedRef)
  );
  p.rotation = degToRadf(baseAngle);

  const animOffset = props.params[CPUParticlesParameter.ANIM_OFFSET]!;
  const offset = f(texAnimOffset * lerpf(animOffset.min, animOffset.max, p.animOffsetRand));
  const progress = f(f(tv * texAnimSpeed) * lerpParam(props, CPUParticlesParameter.ANIM_SPEED, seedRef));
  p.custom[2] = f(offset + progress);

  return tv;
}

/** Scale, colour, hue rotation and the quad's basis, run for every particle. */
function applyAppearance(input: ParticleSimInput, p: Particle, tv: number): void {
  const { props, curves, colorRamp } = input;

  const scaleCurve = curves[CPUParticlesParameter.SCALE] ?? null;
  const texScale = scaleCurve ? f(sampleCurve(scaleCurve, tv)) : 1.0;

  const hueCurve = curves[CPUParticlesParameter.HUE_VARIATION] ?? null;
  // Unlike every other slot this one defaults to 0, not 1: with no curve there
  // is no hue rotation at all.
  const texHueVariation = hueCurve ? f(sampleCurve(hueCurve, tv)) : 0.0;

  const hueParam = props.params[CPUParticlesParameter.HUE_VARIATION]!;
  const hueRotAngle = f(texHueVariation * TAU * lerpf(hueParam.min, hueParam.max, p.hueRotRand));

  const base = colorRamp ? multiplyColor(sampleGradientColor(colorRamp, tv), props.color) : props.color;
  // Called unconditionally, not short-circuited at angle 0: Godot's basis is not
  // quite the identity there. The blue column comes out at -0.001/-0.001/1, so
  // every particle takes a slight tint.
  const rotated = rotateHue(base, hueRotAngle);

  p.color = multiplyColor(rotated, multiplyColor(p.baseColor, p.startColorRand));

  if (props.particle_flag_align_y) {
    const yAxis = normalizedVector2(
      vector2Length(p.velocity) > 0 ? p.velocity : { x: p.transform.c, y: p.transform.d }
    );
    p.transform.c = yAxis.x;
    p.transform.d = yAxis.y;
    // Vector2::orthogonal() is (y, -x).
    p.transform.a = yAxis.y;
    p.transform.b = -yAxis.x;
  } else {
    p.transform.a = f(Math.cos(p.rotation));
    p.transform.b = -f(Math.sin(p.rotation));
    p.transform.c = f(Math.sin(p.rotation));
    p.transform.d = f(Math.cos(p.rotation));
  }

  const scaleParam = props.params[CPUParticlesParameter.SCALE]!;
  const scale = flooredScale(f(texScale * lerpf(scaleParam.min, scaleParam.max, p.scaleRand)));
  p.transform.a = f(p.transform.a * scale);
  p.transform.b = f(p.transform.b * scale);
  p.transform.c = f(p.transform.c * scale);
  p.transform.d = f(p.transform.d * scale);
}

/** The smallest scale Godot draws: a zero-scale quad never collapses the basis. */
const MIN_SCALE = 0.00001;

function flooredScale(scale: number): number {
  return scale < MIN_SCALE ? f(MIN_SCALE) : scale;
}

/**
 * `_update_particle_data_buffer`: the live particles in draw order, mapped back
 * into the emitter node's local space.
 */
function collectPose(state: SimState, props: CPUParticles2DProperties): RenderedParticle[] {
  const inverse = affineInverseTransform2Df(state.emissionXform);

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
      transform: multiplyTransform2Df(inverse, p.transform),
      color: p.color,
      anim: p.custom[2],
      age: p.time,
      index,
    });
  }
  return pose;
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
  props: CPUParticles2DProperties,
  param: EnumValue<typeof CPUParticlesParameter>,
  seedRef: SeedRef
): number {
  const slot = props.params[param]!;
  return lerpf(slot.min, slot.max, randFromSeed(seedRef));
}

/** `Color::operator*` (`core/math/color.h`) in `real_t` float. */
function multiplyColor(a: Rgba, b: Rgba): Rgba {
  return { r: f(a.r * b.r), g: f(a.g * b.g), b: f(a.b * b.b), a: f(a.a * b.a) };
}

type Triple = readonly [number, number, number];

/** The three `Basis` constants Godot blends into its hue rotation (`cpu_particles_2d.cpp:1090-1092`). */
const HUE_LUMINANCE: Triple = [0.299, 0.587, 0.114];
const HUE_COSINE_ROWS: readonly Triple[] = [
  [0.701, -0.587, -0.114],
  [-0.299, 0.413, -0.114],
  [-0.3, -0.588, 0.886],
];
const HUE_SINE_ROWS: readonly Triple[] = [
  [0.168, 0.33, -0.497],
  [-0.328, 0.035, 0.292],
  [1.25, -1.05, -0.203],
];

/**
 * Godot's YIQ-style hue rotation: three constant bases blended by cos/sin of the
 * angle, then applied with `Basis::xform_inv`, the transpose, in `real_t` float.
 */
function rotateHue(color: Rgba, angle: number): Rgba {
  const c = f(Math.cos(angle));
  const s = f(Math.sin(angle));

  // Row j of the blended basis: `mat1[j] + mat2[j] * c + mat3[j] * s`.
  const rows = HUE_COSINE_ROWS.map((cosine, j) =>
    cosine.map((_, k) => f(f(f(HUE_LUMINANCE[k]!) + f(f(cosine[k]!) * c)) + f(f(HUE_SINE_ROWS[j]![k]!) * s)))
  );
  // `xform_inv` reads down a column of the rows, not across one.
  const channel = (k: number) =>
    f(f(f(rows[0]![k]! * color.r) + f(rows[1]![k]! * color.g)) + f(rows[2]![k]! * color.b));

  return { r: channel(0), g: channel(1), b: channel(2), a: color.a };
}
