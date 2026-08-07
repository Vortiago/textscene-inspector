/**
 * CPUParticles2D's simulation, evaluated ONCE to a frozen pose.
 *
 * This is a port of `CPUParticles2D::_particles_process` plus the preprocess
 * loop `_update_internal` runs when `time == 0`. It is deliberately not a live
 * emitter:
 *
 *  - Godot's own preprocess steps at a FIXED 1/30 s (or `fixed_fps`) and runs
 *    only at `time == 0` (`cpu_particles_2d.cpp:732-753`), so a preprocessed
 *    pose is a pure function of the scene file — `preprocess` is serialised,
 *    unlike the constructor's randomised `seed`.
 *  - The golden-image harness fails a scene that never settles, and the
 *    isometric dungeon instances a candle, so a running emitter would make a
 *    shipped golden permanently unstable.
 *  - The animation transport is selection-driven and starts stopped
 *    (ADR-0012); particles belong to neither half of that contract, and a
 *    second always-on clock is the cross-cutting machinery it exists to avoid.
 *
 * Godot's own output is NOT reproducible for a scene that sets neither
 * `use_fixed_seed` nor `preprocess` — the emitter seeds from an unserialised
 * global RNG, and two consecutive reference renders of the same scene differ.
 * What IS reproducible is OURS: a fixed substitute seed and a fixed evaluation
 * window, so the same file always renders the same pixels. Where the scene
 * does pin its seed and preprocess, the shared PCG32 port (godotRng.ts) puts
 * the particles in Godot's actual places rather than statistically similar ones.
 *
 * A pure function of its input, and React-free — `Component.tsx` turns the
 * returned poses into geometry. Not THREE-free, though: `sampleGradientColor`
 * lives beside the gradient rasteriser, which imports THREE at module scope.
 * That costs nothing here (the linter entry point pulls only the parser and the
 * rules, never this file), and reusing the canonical sampler beats a second
 * implementation of `Gradient::get_color_at_offset`.
 *
 * ---------------------------------------------------------------------------
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
 * ---------------------------------------------------------------------------
 */

import type { Color, Vector2 } from '../../base/node2d/types';
import type { Curve } from '../../../resources/curve/types';
import { sampleCurve } from '../../../resources/curve/sample';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import { sampleGradientColor } from '../../../resources/textures/gradienttexture2d/renderer';
import { GodotRandomPCG, idhash, randFromSeed, type SeedRef } from './godotRng';
import {
  CPUParticles2DDrawOrder,
  CPUParticles2DEmissionShape,
  CPUParticles2DParam,
  type CPUParticles2DProperties,
} from './types';

/**
 * A Godot `Transform2D`: two basis columns plus the origin column. Named after
 * the columns rather than as a matrix so the port reads like the C++.
 */
export interface Affine2D {
  /** `columns[0]` — the local X axis. */
  ax: number;
  ay: number;
  /** `columns[1]` — the local Y axis. */
  bx: number;
  by: number;
  /** `columns[2]` — the origin. */
  ox: number;
  oy: number;
}

export const IDENTITY_AFFINE: Affine2D = { ax: 1, ay: 0, bx: 0, by: 1, ox: 0, oy: 0 };

/**
 * The seed we substitute when a scene does not set `use_fixed_seed`. Godot uses
 * `Math::rand()` there, which is unserialised — any constant is as faithful as
 * any other, and a constant is what makes OUR render byte-stable.
 */
export const DEFAULT_PREVIEW_SEED = 0;

/**
 * Ceiling on preprocess/settle steps. A scene asking for `preprocess = 100000`
 * would otherwise spin three million iterations before the first paint. Real
 * emitters need tens of steps; this only stops a pathological file.
 */
export const MAX_SIM_STEPS = 4096;

/** Godot's `Curve` slots, indexed by `CPUParticles2DParam`; null where unset. */
export type ParticleCurves = ReadonlyArray<Curve | null>;

export interface ParticleSimInput {
  props: CPUParticles2DProperties;
  curves: ParticleCurves;
  colorRamp: Gradient | null;
  colorInitialRamp: Gradient | null;
  /**
   * The emitter's world transform in Godot 2D pixel space. Used only when
   * `local_coords` is false, where Godot spawns in global space and draws the
   * canvas item with an identity transform; we render inside the node's group,
   * so the pose is mapped back through this transform's inverse.
   */
  emissionTransform: Affine2D;
}

/** One particle as the renderer needs it: where its quad goes, and its tint. */
export interface RenderedParticle {
  /** Item-local `Transform2D` mapping the texture quad's local corners. */
  transform: Affine2D;
  /** Godot's `p.color` — sRGB, alpha included, curve/ramp/hue already applied. */
  color: Color;
  /**
   * Godot's `p.custom[2]`, reaching the canvas shader as `INSTANCE_CUSTOM.z`:
   * `anim_offset + age × anim_speed`. A `CanvasItemMaterial` with
   * `particles_animation` turns it into a flipbook cell index.
   */
  anim: number;
  /** `p.time`, in seconds. The `draw_order = Lifetime` sort key. */
  age: number;
  /** The particle's index in the emitter, i.e. its `draw_order = Index` order. */
  index: number;
}

/** Godot's private `Particle` struct, only the fields the process loop reads. */
interface Particle {
  transform: Affine2D;
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

/** Godot's inspector floor for `lifetime`; its setter rejects anything lower. */
const MIN_LIFETIME = 0.01;

/**
 * How long to simulate, and at what rate.
 *
 * An authored `preprocess` is Godot's own settle, and Godot runs it with
 * `speed_scale` forced to 1 so the step bookkeeping stays honest
 * (`cpu_particles_2d.cpp:744-746`) — so `speed_scale` genuinely does not affect
 * a preprocessed pose. With no preprocess we are inventing the moment to freeze,
 * and there the right model is ordinary frames: one lifetime reaches a
 * continuous emitter's steady state, and those frames DO honour `speed_scale`.
 * A `one_shot` burst is caught at half a lifetime instead — a full one would
 * leave every particle a frame from death, i.e. an emitter that reads as empty.
 *
 * That difference decides `wholeSteps` too. Replaying Godot's settle means
 * replaying how it ends: it steps a full frame while any time remains and lets
 * the last one overshoot, so a window that is not an exact multiple of the step
 * lands PAST where it asked for. An invented window has no engine behaviour to
 * match and every reason to land exactly on the moment it names — one lifetime
 * of full frames overshoots by one, which is the "every particle a frame from
 * death" pose the half-lifetime rule above exists to avoid.
 */
export function evaluationWindow(props: CPUParticles2DProperties): {
  seconds: number;
  speedScale: number;
  wholeSteps: boolean;
} {
  if (props.preprocess > 0)
    return { seconds: props.preprocess, speedScale: 1, wholeSteps: true };
  const lifetime = Math.max(MIN_LIFETIME, props.lifetime);
  return {
    seconds: props.one_shot ? lifetime * 0.5 : lifetime,
    speedScale: props.speed_scale,
    wholeSteps: false,
  };
}

/**
 * Evaluate the emitter to a single pose, in the emitter node's local space and
 * in the order it must be drawn.
 */
export function simulateFrozenPose(input: ParticleSimInput): RenderedParticle[] {
  const { props } = input;
  // `_update_internal` bails before touching the buffer when the emitter is
  // neither active nor emitting, and a scene file cannot make `active` true
  // without `emitting` — script-triggered one-shots ship this way.
  if (!props.emitting) return [];

  const pcount = props.amount;
  if (pcount < 1) return [];

  const lifetime = Math.max(MIN_LIFETIME, props.lifetime);
  const frameTime = props.fixed_fps > 0 ? 1 / props.fixed_fps : 1 / 30;
  const { seconds, speedScale, wholeSteps } = evaluationWindow(props);

  const state: SimState = {
    time: 0,
    cycle: 0,
    emitting: true,
    particles: Array.from({ length: pcount }, newParticle),
    lifetime,
    seed: (props.use_fixed_seed ? props.seed : DEFAULT_PREVIEW_SEED) >>> 0,
    rng: new GodotRandomPCG(0),
    emissionXform: props.local_coords ? IDENTITY_AFFINE : input.emissionTransform,
  };

  // Godot's settle steps a whole frame while any time remains and lets the last
  // one overshoot: `while (todo > 0) { _particles_process(frame_time); todo -=
  // frame_time; }` (`cpu_particles_2d.cpp:733-736`). It never shortens the final
  // step to the remainder, so shortening ours puts a replayed settle up to a
  // full frame behind the engine — a 1.0 s window over a 1/30 s step is 31 full
  // frames there, i.e. 1.0333 s. An invented window lands on its own number.
  let todo = seconds;
  for (let step = 0; todo > 0 && step < MAX_SIM_STEPS; step++) {
    const delta = wholeSteps ? frameTime : Math.min(frameTime, todo);
    particlesProcess(state, input, delta * speedScale);
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
  emissionXform: Affine2D;
}

function newParticle(): Particle {
  return {
    transform: { ...IDENTITY_AFFINE },
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

/** `CPUParticles2D::_particles_process`. `delta` already carries `speed_scale`. */
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

  // A global-coords emitter spawns in world space; `velocity_xform` is the same
  // transform with its translation dropped, since a velocity is a direction.
  const emissionXform = state.emissionXform;
  const velocityXform: Affine2D = { ...emissionXform, ox: 0, oy: 0 };

  const systemPhase = state.time / lifetime;

  for (let i = 0; i < pcount; i++) {
    const p = state.particles[i]!;
    if (!state.emitting && !p.active) continue;

    const localDelta = delta;

    // The birth phase is the particle's slot in the stream: particle i is born
    // i/pcount of the way through each cycle, which is what makes a continuous
    // emitter show every age at once.
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
    let restart = false;

    if (state.time > prevTime) {
      if (restartTime >= prevTime && restartTime < state.time) restart = true;
    } else if (localDelta > 0.0) {
      if (restartTime >= prevTime) restart = true;
      else if (restartTime < state.time) restart = true;
    }

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
        p.transform = multiplyAffine(emissionXform, p.transform);
      }
    } else if (!p.active) {
      continue;
    } else if (p.time >= p.lifetime) {
      p.active = false;
      tv = 1.0;
    } else {
      tv = advanceParticle(state, input, p, localDelta);
    }

    applyAppearance(input, p, tv);

    // Godot integrates position AFTER the appearance pass, and does it on the
    // restart frame too, so a newborn particle is already one step along.
    p.transform.ox += p.velocity.x * localDelta;
    p.transform.oy += p.velocity.y * localDelta;
  }
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
  // Godot samples the ANGLE curve here for the anim offset too — its own
  // copy-paste (`cpu_particles_2d.cpp:916-919`), reproduced so a scene that
  // sets an angle curve gets the same anim offset it does in the engine. Same
  // curve, same `tv`, so it is the same value rather than a second search.
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
  p.transform = { ...IDENTITY_AFFINE };
  p.time = 0;
  p.lifetime = state.lifetime * p.custom[3];
  p.baseColor = { r: 1, g: 1, b: 1, a: 1 };

  emitAtShape(props, p, rng);
}

/**
 * The emission-shape offset. POINTS / DIRECTED_POINTS / RING are absent on
 * purpose: those three draw from Godot's unserialised GLOBAL RNG
 * (`cpu_particles_2d.cpp:975, 992, 995`), not the per-particle one, so no
 * frozen pose can match the engine. The linter warns instead.
 */
function emitAtShape(props: CPUParticles2DProperties, p: Particle, rng: GodotRandomPCG): void {
  switch (props.emission_shape) {
    case CPUParticles2DEmissionShape.Sphere: {
      const t = 2 * Math.PI * rng.randf();
      const radius = props.emission_sphere_radius * rng.randf();
      p.transform.ox = Math.cos(t) * radius;
      p.transform.oy = Math.sin(t) * radius;
      break;
    }
    case CPUParticles2DEmissionShape.SphereSurface: {
      const s = rng.randf();
      const t = 2 * Math.PI * rng.randf();
      const radius = props.emission_sphere_radius * Math.sqrt(1.0 - s * s);
      p.transform.ox = Math.cos(t) * radius;
      p.transform.oy = Math.sin(t) * radius;
      break;
    }
    case CPUParticles2DEmissionShape.Rectangle: {
      // Godot writes this as ONE `Vector2(rng->randf() …, rng->randf() …)`
      // constructor call, and C++ leaves argument evaluation order
      // unspecified — the shipped builds draw Y FIRST. Measured, not derived:
      // rendering this emitter through Godot 4.6.3 puts particle 0 at
      // (+44.5, +9.3) from the node, which is the y-first draw; the x-first
      // reading lands at (+25.4, +16.9) and matches nothing on screen.
      const y = rng.randf();
      const x = rng.randf();
      p.transform.ox = (x * 2.0 - 1.0) * props.emission_rect_extents.x;
      p.transform.oy = (y * 2.0 - 1.0) * props.emission_rect_extents.y;
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

/** Scale, colour, hue rotation and the quad's basis — run for every particle. */
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
  // Called unconditionally, and NOT short-circuited at angle 0: Godot's basis is
  // not quite the identity there. The blue column comes out at -0.001/-0.001/1,
  // so every particle in every scene takes a slight tint, and skipping the call
  // would silently diverge from the engine on the most common path of all.
  const rotated = rotateHue(base, hueRotAngle);

  p.color = multiplyColor(multiplyColor(rotated, p.baseColor), p.startColorRand);

  if (props.particle_flag_align_y) {
    let yAxis: Vector2 =
      Math.hypot(p.velocity.x, p.velocity.y) > 0
        ? { x: p.velocity.x, y: p.velocity.y }
        : { x: p.transform.bx, y: p.transform.by };
    const length = Math.hypot(yAxis.x, yAxis.y);
    yAxis = length > 0 ? { x: yAxis.x / length, y: yAxis.y / length } : { x: 0, y: 0 };
    p.transform.bx = yAxis.x;
    p.transform.by = yAxis.y;
    // Vector2::orthogonal() is (y, -x).
    p.transform.ax = yAxis.y;
    p.transform.ay = -yAxis.x;
  } else {
    p.transform.ax = Math.cos(p.rotation);
    p.transform.ay = -Math.sin(p.rotation);
    p.transform.bx = Math.sin(p.rotation);
    p.transform.by = Math.cos(p.rotation);
  }

  const scaleParam = props.params[CPUParticles2DParam.Scale]!;
  const amount = lerp(scaleParam.min, scaleParam.max, p.scaleRand);
  // Godot floors the scale so a zero-scale quad never collapses the basis.
  const scaleX = Math.max(0.00001, texScale * amount);
  const scaleY = Math.max(0.00001, texScale * amount);
  p.transform.ax *= scaleX;
  p.transform.ay *= scaleX;
  p.transform.bx *= scaleY;
  p.transform.by *= scaleY;
}

/**
 * `_update_particle_data_buffer` — collect the live particles in draw order,
 * mapped back into the emitter node's local space.
 */
function collectPose(state: SimState, props: CPUParticles2DProperties): RenderedParticle[] {
  const inverse = affineInverse(state.emissionXform);

  const order = state.particles.map((_, index) => index);
  if (props.draw_order === CPUParticles2DDrawOrder.Lifetime) {
    // SortLifetime compares `time > time`, i.e. oldest first.
    order.sort((a, b) => state.particles[b]!.time - state.particles[a]!.time);
  }

  const pose: RenderedParticle[] = [];
  for (const index of order) {
    const p = state.particles[index]!;
    // Godot zeroes an inactive particle's transform, collapsing its quad to a
    // point; omitting it draws the same nothing for a fraction of the vertices.
    if (!p.active) continue;
    pose.push({
      transform: multiplyAffine(inverse, p.transform),
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
 * Godot's YIQ-style hue rotation: three constant bases blended by cos/sin of
 * the angle, then applied with `Basis::xform_inv` (i.e. the TRANSPOSE).
 */
function rotateHue(color: Color, angle: number): Color {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  // The three luminance constants each basis row is built from.
  const lr = 0.299;
  const lg = 0.587;
  const lb = 0.114;

  // Columns of the blended basis. Godot applies it with `Basis::xform_inv`, the
  // TRANSPOSE, so each output channel reads down a column rather than across a row.
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

/** `Transform2D::basis_xform` — the linear part only. */
function basisXform(t: Affine2D, v: Vector2): Vector2 {
  return { x: t.ax * v.x + t.bx * v.y, y: t.ay * v.x + t.by * v.y };
}

/** `Transform2D::operator*` — `a` applied to `b`. */
function multiplyAffine(a: Affine2D, b: Affine2D): Affine2D {
  const col0 = basisXform(a, { x: b.ax, y: b.ay });
  const col1 = basisXform(a, { x: b.bx, y: b.by });
  const origin = basisXform(a, { x: b.ox, y: b.oy });
  return {
    ax: col0.x,
    ay: col0.y,
    bx: col1.x,
    by: col1.y,
    ox: origin.x + a.ox,
    oy: origin.y + a.oy,
  };
}

/**
 * `Transform2D::affine_inverse`. A singular transform (a scene that scales a
 * node to zero) has no inverse; Godot's own `ERR_FAIL_COND` leaves the matrix
 * untouched, so we answer identity rather than propagate NaN through the pose.
 */
function affineInverse(t: Affine2D): Affine2D {
  const det = t.ax * t.by - t.ay * t.bx;
  if (det === 0 || !Number.isFinite(det)) return { ...IDENTITY_AFFINE };
  const idet = 1 / det;
  const ax = t.by * idet;
  const ay = -t.ay * idet;
  const bx = -t.bx * idet;
  const by = t.ax * idet;
  return {
    ax,
    ay,
    bx,
    by,
    ox: -(ax * t.ox + bx * t.oy),
    oy: -(ay * t.ox + by * t.oy),
  };
}
