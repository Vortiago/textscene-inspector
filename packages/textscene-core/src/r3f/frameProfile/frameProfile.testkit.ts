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

/** What a profile reads of a renderer: no timer query or GPU name, a draw count a test moves, a list. */
export function profiledRendererMembers() {
  const info = {
    autoReset: true,
    render: { calls: 0 },
    reset: () => (info.render.calls = 0),
  };
  const list = { opaque: [], transmissive: [], transparent: [] } as unknown as THREE.WebGLRenderList;
  const context = { getExtension: () => null, getParameter: () => null };
  return { getContext: () => context, info, renderLists: { get: () => list } };
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

/** A timer-query context on a GPU clock the test moves, whose results and context loss act as a browser's. */
export function timerContext() {
  const ext = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
  interface FakeQuery {
    context: number;
    startNs: number;
    elapsedNs: number;
    isAvailable: boolean;
  }
  let gpuNs = 0;
  let running: FakeQuery | null = null;
  const live = new Set<FakeQuery>();
  const state = { isDisjoint: false, isLost: false, overlaps: 0, staleBegins: 0, contextsMade: 1 };
  const isStale = (query: FakeQuery) => query.context !== state.contextsMade;
  const context = {
    QUERY_RESULT: 0x8866,
    QUERY_RESULT_AVAILABLE: 0x8867,
    getExtension: (name: string) => (name === 'EXT_disjoint_timer_query_webgl2' ? ext : null),
    isContextLost: () => state.isLost,
    createQuery: (): FakeQuery | null => {
      if (state.isLost) return null;
      const query = { context: state.contextsMade, startNs: 0, elapsedNs: 0, isAvailable: false };
      live.add(query);
      return query;
    },
    deleteQuery: (query: FakeQuery) => live.delete(query),
    beginQuery: (_target: number, query: FakeQuery | null) => {
      if (!query) throw new TypeError('beginQuery: query is not a WebGLQuery');
      if (isStale(query)) state.staleBegins += 1;
      if (running) state.overlaps += 1;
      query.startNs = gpuNs;
      query.isAvailable = false;
      running = query;
    },
    endQuery: () => {
      running!.elapsedNs = gpuNs - running!.startNs;
      running = null;
    },
    getQueryParameter: (query: FakeQuery, pname: number) => {
      if (state.isLost || isStale(query)) return null;
      return pname === context.QUERY_RESULT_AVAILABLE ? query.isAvailable : query.elapsedNs;
    },
    getParameter: (pname: number) => (pname === ext.GPU_DISJOINT_EXT ? state.isDisjoint : null),
  };
  return {
    renderer: { ...profiledRendererMembers(), getContext: () => context } as unknown as THREE.WebGLRenderer,
    advanceGpu: (ms: number) => (gpuNs += ms * 1e6),
    resolve: () => live.forEach((query) => (query.isAvailable = true)),
    loseContext: () => (state.isLost = true),
    restoreContext: () => {
      state.isLost = false;
      state.contextsMade += 1;
    },
    liveQueries: () => live.size,
    state,
  };
}
