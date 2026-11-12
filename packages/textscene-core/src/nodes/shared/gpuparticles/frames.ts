/**
 * The frame loop of `ParticlesStorage::_particles_process` (`particles_storage.cpp:822-849`) and the
 * restart test of `particles.glsl:388-438`: the system phase, the cycle count, and which particle
 * restarts in a step and for how much of it.
 *
 * Derived from Godot Engine (`servers/rendering/renderer_rd/storage_rd/particles_storage.cpp` and `servers/rendering/renderer_rd/shaders/particles.glsl`), used
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
import { idhash } from '../cpuparticles/godotRng';
import type { GpuEmitter } from './emitter';

/** The clock of one emitter. `phase` and `cycle` persist between steps. */
export interface SystemClock {
  /** A double, as the server keeps it. */
  phase: number;
  cycle: number;
  emitting: boolean;
  /** True until the first step, which numbers the cycles from 0. */
  isClear: boolean;
}

export function startClock(emitter: GpuEmitter): SystemClock {
  return { phase: 0, cycle: 0, emitting: emitter.emitting, isClear: true };
}

/** What one step gives the restart test of every particle (`FRAME`). */
export interface FrameParams {
  emitting: boolean;
  /** Floats, as the shader reads them. */
  systemPhase: number;
  previousPhase: number;
  delta: number;
  cycle: number;
}

/** Advances `clock` by `delta` seconds, as a `double`, and returns the frame its particles read. */
export function advanceClock(clock: SystemClock, emitter: GpuEmitter, delta: number): FrameParams {
  const previousPhase = clock.phase;
  const phase = (previousPhase + delta / emitter.lifetime) % 1;
  if (clock.isClear) {
    clock.cycle = 0;
  } else if (phase < previousPhase) {
    if (emitter.oneShot) clock.emitting = false;
    clock.cycle++;
  }
  clock.isClear = false;
  clock.phase = phase;
  return {
    emitting: clock.emitting,
    systemPhase: f(phase),
    previousPhase: f(previousPhase),
    delta: f(delta),
    cycle: clock.cycle,
  };
}

/** The phase at which particle `index` is born in each cycle (`:388-405`). */
function restartPhase(index: number, emitter: GpuEmitter, frame: FrameParams): number {
  const total = emitter.amount;
  let phase = f(index / total);
  if (emitter.randomness > 0) {
    let seed = frame.cycle >>> 0;
    if (phase >= frame.systemPhase) seed = (seed - 1) >>> 0;
    seed = Math.imul(seed, total) >>> 0;
    seed = (seed + index) >>> 0;
    const random = f((idhash(seed) % 65536) / 65536);
    phase = f(phase + f(f(f(emitter.randomness * random) * 1) / total));
  }
  return f(phase * f(1 - emitter.explosiveness));
}

/**
 * The delta the first step of particle `index` takes (`local_delta`) when it restarts in `frame`, else
 * undefined. A non-emitting system restarts nothing. No object per call: the settle asks every particle on every step.
 */
export function restartDelta(index: number, emitter: GpuEmitter, frame: FrameParams): number | undefined {
  if (!frame.emitting) return undefined;
  const phase = restartPhase(index, emitter, frame);
  const { systemPhase, previousPhase } = frame;
  if (systemPhase > previousPhase) {
    if (phase >= previousPhase && phase < systemPhase)
      return localDelta(f(systemPhase - phase), emitter, frame);
  } else if (frame.delta > 0) {
    if (phase >= previousPhase) return localDelta(f(f(1 - phase) + systemPhase), emitter, frame);
    if (phase < systemPhase) return localDelta(f(systemPhase - phase), emitter, frame);
  }
  return undefined;
}

/** `fract_delta` spends the share of the lifetime since the restart, else the whole step. */
function localDelta(span: number, emitter: GpuEmitter, frame: FrameParams): number {
  return emitter.fractDelta ? f(span * f(emitter.lifetime)) : frame.delta;
}
