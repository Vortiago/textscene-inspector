/**
 * The frame loop of `ParticlesStorage::_particles_process` (`particles_storage.cpp:822-849`) and the
 * restart test of `particles.glsl:388-438`: the system phase, the cycle count, and which particle
 * restarts in a step and for how much of it.
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

/** Whether a particle restarts in a step, and the delta its first step takes (`local_delta`). */
export interface Restart {
  restarts: boolean;
  localDelta: number;
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

/** The restart of particle `index` in `frame`. A non-emitting system restarts nothing. */
export function restartOf(index: number, emitter: GpuEmitter, frame: FrameParams): Restart {
  const none: Restart = { restarts: false, localDelta: frame.delta };
  if (!frame.emitting) return none;
  const phase = restartPhase(index, emitter, frame);
  const lifetime = f(emitter.lifetime);
  const { systemPhase, previousPhase } = frame;
  const fractional = (span: number): number => (emitter.fractDelta ? f(span * lifetime) : frame.delta);
  if (systemPhase > previousPhase) {
    if (phase >= previousPhase && phase < systemPhase) {
      return { restarts: true, localDelta: fractional(f(systemPhase - phase)) };
    }
  } else if (frame.delta > 0) {
    if (phase >= previousPhase) {
      return { restarts: true, localDelta: fractional(f(f(1 - phase) + systemPhase)) };
    }
    if (phase < systemPhase) {
      return { restarts: true, localDelta: fractional(f(systemPhase - phase)) };
    }
  }
  return none;
}
