import {
  RENDER_STEPS,
  type FrameStats,
  type FrameTimings,
  type StepKey,
  type StepStats,
} from './frameStats.js';

const STEP_KEYS: readonly StepKey[] = [...RENDER_STEPS, 'Other'];

export const NS_PER_MS = 1e6;

/** One run's sums: a published window's, reset each time it publishes, or a recording's. */
export class WindowSums {
  frames = 0;
  intervals = 0;
  intervalMs = 0;
  cpuMs = 0;
  drawCalls = 0;
  objects = 0;
  primitives = 0;
  uploads = 0;
  readonly stepCpuMs = new Map<StepKey, number>();
  readonly stepRuns = new Map<StepKey, number>();
  readonly stepDrawCalls = new Map<StepKey, number>();
  gpuFrames = 0;
  gpuNs = 0;
  readonly stepGpuNs = new Map<StepKey, number>();

  /** A GPU time per frame from `ns`, or null while no frame's GPU result has arrived in the run. */
  gpuMsPerFrame(ns: number): number | null {
    return this.gpuFrames > 0 ? ns / NS_PER_MS / this.gpuFrames : null;
  }
}

/** The per-frame means of `sums`, with the timings when they ran over its frames. */
export function statsOf(sums: WindowSums, timings: { hasGpuTimer: boolean } | null): FrameStats {
  const { frames, intervals, intervalMs, cpuMs, drawCalls, objects, primitives } = sums;
  const frameMs = intervalMs / intervals;
  return {
    fps: 1000 / frameMs,
    frameMs,
    cpuMs: cpuMs / frames,
    drawCallsPerFrame: drawCalls / frames,
    objectsPerFrame: objects / frames,
    primitivesPerFrame: primitives / frames,
    ...(timings && { timings: timingsOf(sums, timings.hasGpuTimer) }),
  };
}

function timingsOf(sums: WindowSums, hasGpuTimer: boolean): FrameTimings {
  const { frames, gpuNs, uploads, stepCpuMs, stepRuns, stepDrawCalls, stepGpuNs } = sums;
  const steps: StepStats[] = [];
  for (const step of STEP_KEYS) {
    const runs = step === 'Other' ? frames : (stepRuns.get(step) ?? 0);
    // A GPU result arrives frames late, so a step that did not run keeps its row: rows sum to the GPU time.
    if (runs === 0 && !stepGpuNs.has(step)) continue;
    steps.push({
      step,
      cpuMs: (stepCpuMs.get(step) ?? 0) / frames,
      gpuMs: sums.gpuMsPerFrame(stepGpuNs.get(step) ?? 0),
      runsPerFrame: runs / frames,
      drawCallsPerFrame: (stepDrawCalls.get(step) ?? 0) / frames,
    });
  }
  return { gpuMs: sums.gpuMsPerFrame(gpuNs), hasGpuTimer, uploadsPerFrame: uploads / frames, steps };
}

/** Adds `amount` to the sum at `key`. */
export function add<K>(sums: Map<K, number>, key: K, amount: number): void {
  sums.set(key, (sums.get(key) ?? 0) + amount);
}
