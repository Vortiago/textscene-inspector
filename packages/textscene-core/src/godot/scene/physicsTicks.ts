/**
 * The physics ticks Godot runs in each process frame under a fixed frame rate, as the `ref:godot`
 * harness's `--fixed-fps` sets: a port of `MainTimerSync::advance_checked` and `advance_core` (`main_timer_sync.cpp:331-487`).
 * The sync keeps each frame's tick count near the recent typical count, so a tick can land up to
 * `jitterFix` of a tick early or late.
 */

import { clamp } from '../math/math.js';

/** The project settings that pace the physics ticks. */
export interface PhysicsClock {
  /** `physics/common/physics_ticks_per_second`. */
  readonly ticksPerSecond: number;
  /** `physics/common/physics_jitter_fix`, as a fraction of a tick. */
  readonly jitterFix: number;
}

/**
 * Godot's defaults for both settings (`main.cpp:2173,2175`).
 *
 * @canonical The physics clock of a project that sets neither tick setting
 */
export const DEFAULT_PHYSICS_CLOCK: PhysicsClock = { ticksPerSecond: 60, jitterFix: 0.5 };

/** `MainTimerSync::CONTROL_STEPS`, the frames back the sync compares tick counts over. */
const CONTROL_STEPS = 12;

/** `MainTimerSync`'s state, which a scene's frames advance from its constructor's values. */
class MainTimerSync {
  private timeAccum = 0;
  private timeDeficit = 0;
  private readonly accumulatedSteps = Array.from({ length: CONTROL_STEPS }, (_, i) => i);
  private readonly typicalSteps = Array.from({ length: CONTROL_STEPS }, (_, i) => i);
  private readonly physicsStep: number;

  constructor(
    private readonly clock: PhysicsClock,
    private readonly fixedFps: number
  ) {
    this.physicsStep = 1 / clock.ticksPerSecond;
  }

  /** The ticks of the next process frame (`advance_checked`, `main_timer_sync.cpp:414-487`). */
  advance(): number {
    let processStep = 1 / this.fixedFps;
    // A `float` in Godot, not a `double`.
    const minOutputStep = Math.fround(Math.max(Math.fround(processStep / 8), 1e-6));
    processStep += this.timeDeficit;
    let steps = this.advanceCore(processStep);
    let outputStep = processStep;
    const processMinusAccum = outputStep - this.timeAccum;
    const [consistentSteps, minAverage, maxAverage] = this.averagePhysicsSteps();
    if (consistentSteps > 3) {
      outputStep = clamp(outputStep, minAverage * this.physicsStep, maxAverage * this.physicsStep);
    }
    const maxClockDeviation = this.clock.jitterFix * this.physicsStep;
    outputStep = clamp(outputStep, processStep - maxClockDeviation, processStep + maxClockDeviation);
    outputStep = clamp(outputStep, processMinusAccum, processMinusAccum + this.physicsStep);
    outputStep = Math.max(outputStep, minOutputStep);
    this.timeAccum = outputStep - processMinusAccum;
    if (this.timeAccum > this.physicsStep) {
      const extraSteps = Math.floor(this.timeAccum * this.clock.ticksPerSecond);
      this.timeAccum -= extraSteps * this.physicsStep;
      steps += extraSteps;
    }
    this.timeDeficit = processStep - outputStep;
    return steps;
  }

  /** `advance_core` (`main_timer_sync.cpp:331-411`): the ticks before `advance` clamps the step. */
  private advanceCore(processStep: number): number {
    this.timeAccum += processStep;
    const ticksAccumulated = this.timeAccum * this.clock.ticksPerSecond;
    let steps = Math.floor(ticksAccumulated);
    const bounds = this.typicalStepBounds();
    let updateTypical = bounds.updateTypical;
    if (steps < bounds.min) {
      const maxPossible = Math.floor(ticksAccumulated + this.clock.jitterFix);
      updateTypical ||= maxPossible < bounds.min;
      steps = Math.min(maxPossible, bounds.min);
    } else if (steps > bounds.max) {
      const minPossible = Math.floor(ticksAccumulated - this.clock.jitterFix);
      updateTypical ||= minPossible > bounds.max;
      steps = Math.max(minPossible, bounds.max);
    }
    steps = Math.max(steps, 0);
    this.timeAccum -= steps * this.physicsStep;
    for (let i = CONTROL_STEPS - 2; i >= 0; i--) {
      this.accumulatedSteps[i + 1] = this.accumulatedSteps[i]! + steps;
    }
    this.accumulatedSteps[0] = steps;
    if (updateTypical) this.updateTypicalSteps();
    return steps;
  }

  /**
   * The tick counts this frame may take to stay typical (`main_timer_sync.cpp:340-360`). When the
   * recent frames already left the typical counts, the bounds stop at the frame that left them, and
   * the typical counts move after this frame.
   */
  private typicalStepBounds(): { min: number; max: number; updateTypical: boolean } {
    let min = this.typicalSteps[0]!;
    let max = min + 1;
    for (let i = 0; i < CONTROL_STEPS - 1; i++) {
      const stepsLeft = this.typicalSteps[i + 1]! - this.accumulatedSteps[i]!;
      if (stepsLeft > max || stepsLeft + 1 < min) return { min, max, updateTypical: true };
      min = Math.max(min, stepsLeft);
      max = Math.min(max, stepsLeft + 1);
    }
    return { min, max, updateTypical: false };
  }

  /** `main_timer_sync.cpp:400-409`: each typical count moves to within one below the accumulated count. */
  private updateTypicalSteps(): void {
    for (let i = CONTROL_STEPS - 1; i >= 0; i--) {
      const accumulated = this.accumulatedSteps[i]!;
      this.typicalSteps[i] = clamp(this.typicalSteps[i]!, accumulated - 1, accumulated);
    }
  }

  /**
   * `get_average_physics_steps` (`main_timer_sync.cpp:307-328`): the bounds on the ticks per
   * frame, and the frames back they hold for.
   */
  private averagePhysicsSteps(): [consistentSteps: number, min: number, max: number] {
    let min = this.typicalSteps[0]!;
    let max = min + 1;
    for (let i = 1; i < CONTROL_STEPS; i++) {
      const typicalLower = this.typicalSteps[i]!;
      const currentMin = typicalLower / (i + 1);
      if (currentMin > max) return [i, min, max];
      min = Math.max(min, currentMin);
      const currentMax = (typicalLower + 1) / (i + 1);
      if (currentMax < min) return [i, min, max];
      max = Math.min(max, currentMax);
    }
    return [CONTROL_STEPS, min, max];
  }
}

/**
 * The physics ticks Godot runs from process frame 0 to the end of process frame `frame`, at
 * `fixedFps` process frames a second.
 */
export function physicsTicksThrough(frame: number, fixedFps: number, clock: PhysicsClock): number {
  const sync = new MainTimerSync(clock, fixedFps);
  let ticks = 0;
  for (let f = 0; f <= frame; f++) ticks += sync.advance();
  return ticks;
}
