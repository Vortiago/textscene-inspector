/**
 * The steps of `_particles_process` and `_update_internal` that `cpu_particles_2d.cpp` and
 * `cpu_particles_3d.cpp` carry alike: the settle, each particle's restart instant, its parameters
 * and its colour.
 * Every number is the `real_t` or `double` the engine holds, rounded where Godot rounds.
 *
 * Derived from Godot Engine (`scene/2d/cpu_particles_2d.cpp`, `scene/3d/cpu_particles_3d.cpp`), used
 * under the MIT licence:
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

import { storedReal as f } from '../../../godot/math/real.js';
import { lerpf, multiplyColorInto, type Rgba } from '../../../godot/math/math.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import type { CPUParticlesParameter } from '../../../godot/scene/cpuParticles';
import type { Curve } from '../../../resources/curves/curve/types';
import { sampleCurve } from '../../../resources/curves/curve/sample';
import { idhash, randFromSeed, type SeedRef } from './godotRng';
import type { ParticleParam } from './params';

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
const MAX_SETTLE_STEPS = 4096;

/** What the settle reads of an emitter. */
export interface SettledEmitter {
  preprocess: number;
  lifetime: number;
  oneShot: boolean;
  fixedFps: number;
  /** A `double`, which `_update_internal` narrows to `real_t` when it restores it after the settle. */
  speedScale: number;
}

/**
 * Seconds of settle the frozen pose sits at: the authored `preprocess`, else one
 * lifetime (steady state), halved for a `one_shot` burst to catch it mid-flight.
 * `_update_internal` spends both through one loop (`cpu_particles_3d.cpp:677-688`),
 * so `pnpm ref:godot --particles <seconds>` renders the same instant in Godot.
 */
function settleSeconds({ preprocess, lifetime, oneShot }: SettledEmitter): number {
  if (preprocess > 0) return preprocess;
  return oneShot ? lifetime * 0.5 : lifetime;
}

/** The step the settle spends its seconds in: `1.0 / fixed_fps`, else `1.0 / 30.0` (`:672-676`). */
function settleFrameTime({ fixedFps }: SettledEmitter): number {
  return fixedFps > 0 ? 1.0 / fixedFps : 1.0 / 30.0;
}

/**
 * Runs `step` the times Godot's settle does. It steps whole frames and the last one overshoots:
 * `while (todo > 0) { _particles_process(frame_time); todo -= frame_time; }` (`:684-687`), so 1.0 s
 * at 1/30 s is 31 frames. `speed_scale` is held at 1 around the loop (`:682-688`), so it never
 * moves the pose.
 */
export function settle(emitter: SettledEmitter, step: (frameTime: number) => void): void {
  const frameTime = settleFrameTime(emitter);
  let todo = settleSeconds(emitter);
  for (let steps = 0; todo > 0 && steps < MAX_SETTLE_STEPS; steps++) {
    step(frameTime);
    todo -= frameTime;
  }
}

/** Each zero-delta step orients an align_y particle again, and in float that is not idempotent. */
const ZERO_DELTA_STEPS: readonly number[] = [0, 0];

/**
 * The steps taken after the settle, before the first draw. A 30 Hz emitter steps once in its
 * enter-tree `_update_internal` and once in the first frame's internal process, before that frame
 * draws (`cpu_particles_3d.cpp:1354-1360`, `:1374-1375`, `:711`), both at a zero delta here. A
 * `fixed_fps` emitter draws first after one whole fixed step at `speed_scale` (`:690-707`).
 */
export function firstDrawnSteps(emitter: SettledEmitter): readonly number[] {
  return emitter.fixedFps > 0 ? [settleFrameTime(emitter) * f(emitter.speedScale)] : ZERO_DELTA_STEPS;
}

/** What a particle's restart instant reads of the emitter and the step. */
export interface RestartClock {
  /** The particle count. */
  pcount: number;
  cycle: number;
  /** The emitter's cycle time before this step. */
  prevTime: number;
  /** The cycle time after this step, wrapped mod `lifetime`. */
  time: number;
  lifetime: number;
  /** This step's `p_delta`. */
  delta: number;
  randomness: number;
  explosiveness: number;
  fractDelta: boolean;
}

/** Whether particle `i` restarts this step, and the delta its position integrates with. */
export interface RestartStep {
  restart: boolean;
  /** `local_delta`: the whole step unless a restart shortens it (`fract_delta`). */
  localDelta: number;
}

/**
 * The restart time of particle `i`: born `i / pcount` of the way through each cycle, so a
 * continuous emitter shows every age at once, jittered by `randomness` and squeezed toward 0 by
 * `explosiveness` (`cpu_particles_3d.cpp:761-775`).
 */
function restartTime(clock: RestartClock, i: number): number {
  const { pcount, cycle, time, lifetime, randomness, explosiveness } = clock;
  let restartPhase = i / pcount;
  if (randomness > 0.0) {
    let hashSeed = cycle >>> 0;
    if (restartPhase >= time / lifetime) hashSeed = (hashSeed - 1) >>> 0;
    hashSeed = Math.imul(hashSeed, pcount) >>> 0;
    hashSeed = (hashSeed + i) >>> 0;
    const random = (idhash(hashSeed) % 65536) / 65536.0;
    restartPhase += (randomness * random * 1.0) / pcount;
  }
  restartPhase *= 1.0 - explosiveness;
  return restartPhase * lifetime;
}

/**
 * Writes into `out` whether particle `i` restarts this step, and its `local_delta`
 * (`cpu_particles_3d.cpp:776-801`). With `fract_delta` (default true) a particle born mid-step gets
 * only the remainder after its restart instant, so same-step births spread into a bar instead of
 * one displacement. The caller still restarts a particle that outlived its lifetime (`:803-805`).
 */
export function restartStep(clock: RestartClock, i: number, out: RestartStep): void {
  const { prevTime, time, lifetime, delta, fractDelta } = clock;
  const restartAt = restartTime(clock, i);
  let restart = false;
  let localDelta = delta;

  if (time > prevTime) {
    // `restart_time >= prev_time` so particles emit in the first frame they are processed.
    if (restartAt >= prevTime && restartAt < time) {
      restart = true;
      if (fractDelta) localDelta = time - restartAt;
    }
  } else if (localDelta > 0.0) {
    // The step wrapped past `lifetime`. A restart near the tail of the cycle gets
    // the slice up to the old boundary plus `time`, and one right after zero
    // gets the ordinary slice.
    if (restartAt >= prevTime) {
      restart = true;
      if (fractDelta) localDelta = lifetime - restartAt + time;
    } else if (restartAt < time) {
      restart = true;
      if (fractDelta) localDelta = time - restartAt;
    }
  }

  out.restart = restart;
  out.localDelta = localDelta;
}

/** The three `Basis` constants Godot blends into its hue rotation (`cpu_particles_3d.cpp:1136-1138`), as floats. */
const HUE_LUMINANCE: readonly number[] = [0.299, 0.587, 0.114].map(f);
const HUE_COSINE_ROWS: readonly (readonly number[])[] = [
  [0.701, -0.587, -0.114],
  [-0.299, 0.413, -0.114],
  [-0.3, -0.588, 0.886],
].map((row) => row.map(f));
const HUE_SINE_ROWS: readonly (readonly number[])[] = [
  [0.168, 0.33, -0.497],
  [-0.328, 0.035, 0.292],
  [1.25, -1.05, -0.203],
].map((row) => row.map(f));

/**
 * The blended basis as three rows, `mat1[j] + mat2[j] * c + mat3[j] * s` in `real_t` float, written
 * into `rows`.
 */
function writeHueRows(rows: number[][], angle: number): number[][] {
  const c = f(Math.cos(angle));
  const s = f(Math.sin(angle));
  for (let j = 0; j < 3; j++) {
    for (let k = 0; k < 3; k++) {
      rows[j]![k] = f(f(HUE_LUMINANCE[k]! + f(HUE_COSINE_ROWS[j]![k]! * c)) + f(HUE_SINE_ROWS[j]![k]! * s));
    }
  }
  return rows;
}

function hueRowsBuffer(): number[][] {
  return [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
}

/** Most particles have no hue curve, so their angle is zero: the basis is built once for them. */
const UNROTATED_HUE_ROWS = writeHueRows(hueRowsBuffer(), 0);

/** Scratch for `rotateHueInto` at a non-zero angle, overwritten by every such call. */
const rotatedHueRows = hueRowsBuffer();

/**
 * Godot's YIQ-style hue rotation of `color` into `out`: three constant bases blended by cos/sin of
 * the angle, then applied with `Basis::xform_inv`, the transpose, in `real_t` float. It runs at
 * angle 0 too, where the basis is not quite the identity: every particle takes a slight tint.
 */
function rotateHueInto(out: Rgba, color: Rgba, angle: number): Rgba {
  const rows = angle === 0 ? UNROTATED_HUE_ROWS : writeHueRows(rotatedHueRows, angle);
  const { r, g, b } = color;
  // `xform_inv` reads down a column of the rows, not across one.
  out.r = f(f(f(rows[0]![0]! * r) + f(rows[1]![0]! * g)) + f(rows[2]![0]! * b));
  out.g = f(f(f(rows[0]![1]! * r) + f(rows[1]![1]! * g)) + f(rows[2]![1]! * b));
  out.b = f(f(f(rows[0]![2]! * r) + f(rows[1]![2]! * g)) + f(rows[2]![2]! * b));
  out.a = color.a;
  return out;
}

/** The colours of a particle its tint reads and writes, each a `Color` as Godot holds it. */
export interface TintedParticle {
  /** `p.color`, which {@link tintParticle} writes. */
  color: Rgba;
  /** `p.base_color`: the emission colour of its point, else white. */
  baseColor: Rgba;
  /** `p.start_color_rand`: the `color_initial_ramp` sample at birth, else white. */
  startColorRand: Rgba;
}

/**
 * Writes `p.color`: `base` hue-rotated by `hueAngle` radians, then `p.color *= p.base_color *
 * p.start_color_rand` (`cpu_particles_3d.cpp:1145-1156`), where the right side multiplies first.
 * `base` is `color`, times the `color_ramp` sample at the particle's age where there is a ramp.
 */
export function tintParticle(p: TintedParticle, base: Rgba, hueAngle: number): void {
  const { color } = p;
  rotateHueInto(color, base, hueAngle);
  multiplyColorInto(color, color, multiplyColorInto(birthTint, p.baseColor, p.startColorRand));
}

/** Scratch for `tintParticle`'s `p.base_color * p.start_color_rand`, overwritten by every call. */
const birthTint: Rgba = { r: 0, g: 0, b: 0, a: 0 };

/** Each parameter's curve, by `CPUParticlesParameter`, null for none. */
export type ParticleCurves = ReadonlyArray<Curve | null>;

/** `curve_parameters[param]->sample(tv)` in float, or 1 for a parameter with no curve. */
export function sampleParam(
  curves: ParticleCurves,
  param: EnumValue<typeof CPUParticlesParameter>,
  tv: number
): number {
  const curve = curves[param] ?? null;
  return curve ? f(sampleCurve(curve, tv)) : 1.0;
}

/** `Math::lerp(parameters_min[p], parameters_max[p], rand_from_seed(seed))`. */
export function lerpParam(
  params: readonly ParticleParam[],
  param: EnumValue<typeof CPUParticlesParameter>,
  seedRef: SeedRef
): number {
  const slot = params[param]!;
  const weight = randFromSeed(seedRef);
  // A constant slot skips the lerp's roundings. `+ 0` keeps its result: -0 lerps to +0.
  return slot.min === slot.max ? f(slot.min) + 0 : lerpf(slot.min, slot.max, weight);
}
