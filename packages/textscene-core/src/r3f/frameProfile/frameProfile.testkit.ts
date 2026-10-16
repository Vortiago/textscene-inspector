/** Drives a frame profile through one published window, for a test of a step's call site. */

import type * as THREE from 'three';
import { startFrameProfile } from './frameProfile';
import type { FrameStats, StepKey } from './frameStats';

/** A frame interval that publishes the first window, of 25 intervals, on the 26th frame. */
export const FRAME_INTERVAL_MS = 20;
export const FRAMES_PER_WINDOW = 26;

/** A clock the test moves by hand. */
export function manualClock(): { now: () => number; advance: (ms: number) => void } {
  let time = 0;
  return { now: () => time, advance: (ms) => (time += ms) };
}

/** A context with no timer query. */
const CPU_ONLY_CONTEXT = { getExtension: () => null };

/**
 * The members of a renderer a profile reads: a context with no timer query, and a draw-call counter
 * a test moves by adding to `info.render.calls`. A fake renderer spreads them beside its own.
 */
export function profiledRendererMembers() {
  const info = {
    autoReset: true,
    render: { calls: 0 },
    reset: () => (info.render.calls = 0),
  };
  return { getContext: () => CPU_ONLY_CONTEXT, info };
}

/** A renderer with only the members a profile reads. */
export function cpuOnlyRenderer(): THREE.WebGLRenderer {
  return profiledRendererMembers() as unknown as THREE.WebGLRenderer;
}

/**
 * The first window a profile on `renderer` publishes while each frame runs `frame`, with `now` as
 * its clock.
 */
export function profiledWindow(
  renderer: THREE.WebGLRenderer,
  now: () => number,
  frame: () => void
): FrameStats {
  let window: FrameStats | null = null;
  const profile = startFrameProfile(renderer, (stats) => (window ??= stats), now);
  for (let index = 0; index < FRAMES_PER_WINDOW; index++) {
    profile.beginFrame(index * FRAME_INTERVAL_MS);
    frame();
    profile.endFrame();
  }
  profile.stop();
  if (!window) throw new Error(`expected a window after ${FRAMES_PER_WINDOW} frames, got none`);
  return window;
}

/** Each step of `stats` that ran, with its CPU time per frame. */
export function stepCpuMs(stats: FrameStats): [StepKey, number][] {
  return stats.steps.map((s) => [s.step, s.cpuMs]);
}
