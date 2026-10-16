/** Drives a frame profile through one published window, for a test of a step's call site. */

import type * as THREE from 'three';
import { startFrameProfile } from './frameProfile';
import type { FrameStats, StepKey } from './frameStats';

/** A frame interval that publishes the first window on the 26th frame. */
const FRAME_INTERVAL_MS = 20;
const FRAMES_PER_WINDOW = 26;

/** A context with no timer query, which a fake renderer answers from `getContext`. */
export const CPU_ONLY_CONTEXT = { getExtension: () => null };

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
