/**
 * The physics ticks Godot runs in each process frame under the `ref:godot` harness's fixed frame
 * rate: a port of `MainTimerSync::advance_checked` and `advance_core` (`main_timer_sync.cpp:331-487`).
 * The sync keeps each frame's tick count near the recent typical count, so a tick can land up to
 * `jitterFix` of a tick early or late.
 */

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

/** The `ref:godot` harness's `--fixed-fps`, the process frames in a second of Godot's time. */
const HARNESS_FIXED_FPS = 1000;

/** `MainTimerSync::CONTROL_STEPS`, the frames back the sync compares tick counts over. */
const CONTROL_STEPS = 12;

/** The process step and tick count of one frame. */
interface FrameTime {
  processStep: number;
  physicsSteps: number;
}

/** `MainTimerSync`'s state, which a scene's frames advance from its constructor's values. */
class MainTimerSync {
  private timeAccum = 0;
  private timeDeficit = 0;
  private readonly accumulatedSteps = Array.from({ length: CONTROL_STEPS }, (_, i) => i);
  private readonly typicalSteps = Array.from({ length: CONTROL_STEPS }, (_, i) => i);
  private readonly physicsStep: number;

  constructor(private readonly clock: PhysicsClock) {
    this.physicsStep = 1 / clock.ticksPerSecond;
  }

  /** The ticks of the next process frame (`advance_checked`, `main_timer_sync.cpp:414-487`). */
  advance(): number {
    let processStep = 1 / HARNESS_FIXED_FPS;
    // A `float` in Godot, not a `double`.
    const minOutputStep = Math.fround(Math.max(Math.fround(processStep / 8), 1e-6));
    processStep += this.timeDeficit;
    const frame = this.advanceCore(processStep);
    const processMinusAccum = frame.processStep - this.timeAccum;
    const [consistentSteps, minAverage, maxAverage] = this.averagePhysicsSteps();
    if (consistentSteps > 3) {
      frame.processStep = clamp(
        frame.processStep,
        minAverage * this.physicsStep,
        maxAverage * this.physicsStep
      );
    }
    const maxClockDeviation = this.clock.jitterFix * this.physicsStep;
    frame.processStep = clamp(
      frame.processStep,
      processStep - maxClockDeviation,
      processStep + maxClockDeviation
    );
    frame.processStep = clamp(frame.processStep, processMinusAccum, processMinusAccum + this.physicsStep);
    frame.processStep = Math.max(frame.processStep, minOutputStep);
    this.timeAccum = frame.processStep - processMinusAccum;
    if (this.timeAccum > this.physicsStep) {
      const extraSteps = Math.floor(this.timeAccum * this.clock.ticksPerSecond);
      this.timeAccum -= extraSteps * this.physicsStep;
      frame.physicsSteps += extraSteps;
    }
    this.timeDeficit = processStep - frame.processStep;
    return frame.physicsSteps;
  }

  /** `advance_core` (`main_timer_sync.cpp:331-411`). */
  private advanceCore(processStep: number): FrameTime {
    this.timeAccum += processStep;
    const ticksAccumulated = this.timeAccum * this.clock.ticksPerSecond;
    let steps = Math.floor(ticksAccumulated);
    const { min, max, ...typical } = this.typicalStepBounds();
    let { updateTypical } = typical;
    if (steps < min) {
      const maxPossible = Math.floor(ticksAccumulated + this.clock.jitterFix);
      updateTypical ||= maxPossible < min;
      steps = Math.min(maxPossible, min);
    } else if (steps > max) {
      const minPossible = Math.floor(ticksAccumulated - this.clock.jitterFix);
      updateTypical ||= minPossible > max;
      steps = Math.max(minPossible, max);
    }
    steps = Math.max(steps, 0);
    this.timeAccum -= steps * this.physicsStep;
    for (let i = CONTROL_STEPS - 2; i >= 0; i--)
      this.accumulatedSteps[i + 1] = this.accumulatedSteps[i]! + steps;
    this.accumulatedSteps[0] = steps;
    if (updateTypical) this.updateTypicalSteps();
    return { processStep, physicsSteps: steps };
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

/** `value` held to `[low, high]`, the low bound first, as `MainFrameTime::clamp_process_step` does. */
function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  return value > high ? high : value;
}

/** The physics ticks Godot runs from process frame 0 to the end of process frame `frame`. */
export function physicsTicksThrough(frame: number, clock: PhysicsClock): number {
  const sync = new MainTimerSync(clock);
  let ticks = 0;
  for (let f = 0; f <= frame; f++) ticks += sync.advance();
  return ticks;
}
