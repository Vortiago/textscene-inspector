/**
 * The frame profile: the CPU and GPU time of each render step on one renderer, averaged over a window of
 * frames and published. While no profile runs on a renderer, a step marker is one map lookup and
 * records nothing.
 */

import type * as THREE from 'three';
import { GpuTimer, type GpuFrame } from './gpuTimer.js';
import {
  RENDER_STEPS,
  type FrameStats,
  type RenderStep,
  type StepKey,
  type StepStats,
} from './frameStats.js';

/**
 * Twice a second: the digits stay readable, and the overlay re-renders rarely enough to leave the
 * frames it measures alone.
 */
const STATS_WINDOW_MS = 500;

const STEP_KEYS: readonly StepKey[] = [...RENDER_STEPS, 'Other'];

/** Written only by `startFrameProfile` and `FrameProfile.stop`. */
const profiles = new WeakMap<THREE.WebGLRenderer, FrameProfile>();

/** Starts timing `step` on `renderer`, when a profile runs there and a frame is open. */
export function beginStep(renderer: THREE.WebGLRenderer, step: RenderStep): void {
  profiles.get(renderer)?.beginStep(step);
}

/** Stops timing `step` on `renderer`, when it is the innermost open step. */
export function endStep(renderer: THREE.WebGLRenderer, step: RenderStep): void {
  profiles.get(renderer)?.endStep(step);
}

/** The innermost step open on `renderer`, or null with none open or no profile running. */
export function innermostStep(renderer: THREE.WebGLRenderer): RenderStep | null {
  return profiles.get(renderer)?.innermostStep() ?? null;
}

/**
 * Starts a profile on `renderer` that calls `publish` once a window of frames has passed. The caller
 * marks each frame with `beginFrame` and `endFrame`, and owns `stop`. A second start on the same
 * renderer replaces the first.
 */
export function startFrameProfile(
  renderer: THREE.WebGLRenderer,
  publish: (stats: FrameStats) => void,
  now: () => number = () => performance.now()
): FrameProfile {
  profiles.get(renderer)?.stop();
  const profile = new FrameProfile(renderer, publish, now);
  profiles.set(renderer, profile);
  return profile;
}

/** One window's sums, reset each time the window publishes. */
class WindowSums {
  frames = 0;
  intervals = 0;
  intervalMs = 0;
  cpuMs = 0;
  readonly stepCpuMs = new Map<StepKey, number>();
  readonly stepCalls = new Map<StepKey, number>();
  gpuFrames = 0;
  gpuNs = 0;
  readonly stepGpuNs = new Map<StepKey, number>();
}

const NS_PER_MS = 1e6;

export class FrameProfile {
  private sums = new WindowSums();
  /** The `beginFrame` timestamp the window opened at, null before the first frame. */
  private windowStart: number | null = null;
  private lastTimestamp: number | null = null;
  private isFrameOpen = false;
  private frameStart = 0;
  /** The open steps, innermost last. */
  private readonly openSteps: RenderStep[] = [];
  /** The step whose own time runs now, and the clock reading it started at. */
  private current: StepKey = 'Other';
  private segmentStart = 0;
  private readonly gpu: GpuTimer | null;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly publish: (stats: FrameStats) => void,
    private readonly now: () => number
  ) {
    this.gpu = GpuTimer.create(renderer.getContext() as WebGL2RenderingContext);
  }

  /** Opens a frame at `timestamp`, the animation frame's time. */
  beginFrame(timestamp: number): void {
    if (profiles.get(this.renderer) !== this) return;
    if (this.isFrameOpen) this.endFrame();
    if (this.lastTimestamp !== null) {
      this.sums.intervals += 1;
      this.sums.intervalMs += timestamp - this.lastTimestamp;
    }
    for (const frame of this.gpu?.collect() ?? []) this.addGpuFrame(frame);
    this.windowStart ??= timestamp;
    this.lastTimestamp = timestamp;
    this.isFrameOpen = true;
    this.frameStart = this.now();
    this.current = 'Other';
    this.segmentStart = this.frameStart;
    this.gpu?.switchTo('Other');
  }

  /** Closes the frame, with every step still open in it. */
  endFrame(): void {
    if (!this.isFrameOpen) return;
    this.endSegment();
    this.gpu?.endFrame();
    this.openSteps.length = 0;
    this.isFrameOpen = false;
    this.sums.frames += 1;
    this.sums.cpuMs += this.now() - this.frameStart;
    if (this.lastTimestamp! - this.windowStart! >= STATS_WINDOW_MS) this.publishWindow();
  }

  /** A step that a render inside it runs again, such as the fog's own shadow pass, counts one run. */
  beginStep(step: RenderStep): void {
    if (!this.isFrameOpen) return;
    if (!this.openSteps.includes(step)) add(this.sums.stepCalls, step, 1);
    this.openSteps.push(step);
    this.switchTo(step);
  }

  endStep(step: RenderStep): void {
    if (this.openSteps.at(-1) !== step) return;
    this.openSteps.pop();
    this.switchTo(this.openSteps.at(-1) ?? 'Other');
  }

  innermostStep(): RenderStep | null {
    return this.openSteps.at(-1) ?? null;
  }

  stop(): void {
    this.isFrameOpen = false;
    this.gpu?.dispose();
    if (profiles.get(this.renderer) === this) profiles.delete(this.renderer);
  }

  /** Ends the running step's segment and starts `next`'s. */
  private switchTo(next: StepKey): void {
    if (next === this.current) return;
    this.endSegment();
    this.current = next;
    this.gpu?.switchTo(next);
  }

  private endSegment(): void {
    const time = this.now();
    add(this.sums.stepCpuMs, this.current, time - this.segmentStart);
    this.segmentStart = time;
  }

  private addGpuFrame(frame: GpuFrame): void {
    this.sums.gpuFrames += 1;
    for (const [step, ns] of frame) {
      this.sums.gpuNs += ns;
      add(this.sums.stepGpuNs, step, ns);
    }
  }

  private publishWindow(): void {
    const { frames, intervals, intervalMs, cpuMs, stepCpuMs, stepCalls, gpuFrames, gpuNs, stepGpuNs } =
      this.sums;
    const gpuMsPerFrame = (ns: number) => (gpuFrames > 0 ? ns / NS_PER_MS / gpuFrames : null);
    const frameMs = intervalMs / intervals;
    const steps: StepStats[] = [];
    for (const step of STEP_KEYS) {
      const calls = step === 'Other' ? frames : (stepCalls.get(step) ?? 0);
      if (calls === 0) continue;
      steps.push({
        step,
        cpuMs: (stepCpuMs.get(step) ?? 0) / frames,
        gpuMs: gpuMsPerFrame(stepGpuNs.get(step) ?? 0),
        callsPerFrame: calls / frames,
      });
    }
    this.publish({
      fps: 1000 / frameMs,
      frameMs,
      cpuMs: cpuMs / frames,
      gpuMs: gpuMsPerFrame(gpuNs),
      hasGpuTimer: this.gpu !== null,
      steps,
    });
    this.sums = new WindowSums();
    this.windowStart = this.lastTimestamp;
  }
}

function add<K>(sums: Map<K, number>, key: K, amount: number): void {
  sums.set(key, (sums.get(key) ?? 0) + amount);
}
