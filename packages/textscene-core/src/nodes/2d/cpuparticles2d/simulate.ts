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
 * A pure function of its input, React-free and THREE-free — `Component.tsx`
 * turns the returned poses into geometry. A colour ramp is sampled per particle
 * and never becomes a texture, so it reads the gradient slice's pure `sample.ts`
 * rather than its rasteriser: the canonical `Gradient::get_color_at_offset` port
 * without a renderer in this file's import closure.
 *
 * The step itself lives in siblings — `particlesProcess` (the per-frame loop),
 * `particleRestart` / `particleAdvance` / `particleAppearance` (its three
 * branches), `particleBuffer` (the buffer's ends), `affine2d` and
 * `particleMath` (the arithmetic), `simTypes` (the shapes they pass around).
 * This file is the window and the entry point.
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

import { IDENTITY_AFFINE } from './affine2d';
import { GodotRandomPCG } from './godotRng';
import { collectPose, newParticle } from './particleBuffer';
import { particlesProcess } from './particlesProcess';
import type { ParticleSimInput, RenderedParticle, SimState } from './simTypes';
import type { CPUParticles2DProperties } from './types';

export { IDENTITY_AFFINE } from './affine2d';
export type { Affine2D } from './affine2d';
export type { ParticleCurves, ParticleSimInput, RenderedParticle } from './simTypes';

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
 */
export function evaluationWindow(props: CPUParticles2DProperties): {
  seconds: number;
  speedScale: number;
} {
  if (props.preprocess > 0) return { seconds: props.preprocess, speedScale: 1 };
  const lifetime = Math.max(MIN_LIFETIME, props.lifetime);
  return {
    seconds: props.one_shot ? lifetime * 0.5 : lifetime,
    speedScale: props.speed_scale,
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
  const { seconds, speedScale } = evaluationWindow(props);

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

  let todo = seconds;
  for (let step = 0; todo > 0 && step < MAX_SIM_STEPS; step++) {
    particlesProcess(state, input, Math.min(frameTime, todo) * speedScale);
    todo -= frameTime;
  }

  return collectPose(state, props);
}
