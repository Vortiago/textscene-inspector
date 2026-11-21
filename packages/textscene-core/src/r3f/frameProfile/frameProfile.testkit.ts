/** Drives a frame profile through one published window, for a test of a step's call site. */

import type * as THREE from 'three';
import { startFrameCount, type FrameProfile } from './frameProfile';
import type { FrameStats, FrameTimings, StepKey } from './frameStats';

/** A profile with the timings on from its first frame, as `show.performance` starts them. */
export function startFrameProfile(
  renderer: THREE.WebGLRenderer,
  publish: (stats: FrameStats) => void,
  now?: () => number
): FrameProfile {
  const profile = startFrameCount(renderer, publish, now);
  profile.startTimings();
  return profile;
}

/** A frame interval that publishes the first window, of 25 intervals, on the 26th frame. */
export const FRAME_INTERVAL_MS = 20;
export const FRAMES_PER_WINDOW = 26;

/** A clock the test moves by hand. */
export function manualClock(): { now: () => number; advance: (ms: number) => void } {
  let time = 0;
  return { now: () => time, advance: (ms) => (time += ms) };
}

/** What a profile reads of a renderer: no timer query, `info.render.calls` a test moves, a list it fills. */
export function profiledRendererMembers() {
  const info = {
    autoReset: true,
    render: { calls: 0 },
    reset: () => (info.render.calls = 0),
  };
  const list = { opaque: [], transmissive: [], transparent: [] } as unknown as THREE.WebGLRenderList;
  return { getContext: () => ({ getExtension: () => null }), info, renderLists: { get: () => list } };
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

/** The timings of a timed profile's window. */
export function timingsOf(stats: FrameStats | null | undefined): FrameTimings {
  if (!stats?.timings) throw new Error('expected the timings of a timed profile, got none');
  return stats.timings;
}

/** Each step of `stats` that ran, with its CPU time per frame. */
export function stepCpuMs(stats: FrameStats): [StepKey, number][] {
  return timingsOf(stats).steps.map((s) => [s.step, s.cpuMs]);
}
