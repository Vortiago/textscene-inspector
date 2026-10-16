import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { beginStep, endStep, innermostStep, startFrameProfile } from './frameProfile';
import type { FrameStats } from './frameStats';

/** A renderer whose context offers no GPU timer, so only CPU time is measured. */
function cpuOnlyRenderer(): THREE.WebGLRenderer {
  return { getContext: () => ({ getExtension: () => null }) } as unknown as THREE.WebGLRenderer;
}

/** A clock the test moves by hand. */
function manualClock(): { now: () => number; advance: (ms: number) => void } {
  let time = 0;
  return { now: () => time, advance: (ms) => (time += ms) };
}

/**
 * A WebGL 2 context with the timer query extension, whose queries measure a GPU clock the test moves
 * by hand. A query's result arrives once the test calls `resolve`.
 */
function timerContext() {
  const ext = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
  interface FakeQuery {
    startNs: number;
    elapsedNs: number;
    isAvailable: boolean;
  }
  let gpuNs = 0;
  let running: FakeQuery | null = null;
  const live = new Set<FakeQuery>();
  const state = { isDisjoint: false, overlaps: 0 };
  const context = {
    QUERY_RESULT: 0x8866,
    QUERY_RESULT_AVAILABLE: 0x8867,
    getExtension: (name: string) => (name === 'EXT_disjoint_timer_query_webgl2' ? ext : null),
    createQuery: (): FakeQuery => {
      const query = { startNs: 0, elapsedNs: 0, isAvailable: false };
      live.add(query);
      return query;
    },
    deleteQuery: (query: FakeQuery) => live.delete(query),
    beginQuery: (_target: number, query: FakeQuery) => {
      if (running) state.overlaps += 1;
      query.startNs = gpuNs;
      query.isAvailable = false;
      running = query;
    },
    endQuery: () => {
      running!.elapsedNs = gpuNs - running!.startNs;
      running = null;
    },
    getQueryParameter: (query: FakeQuery, pname: number) =>
      pname === context.QUERY_RESULT_AVAILABLE ? query.isAvailable : query.elapsedNs,
    getParameter: (pname: number) => (pname === ext.GPU_DISJOINT_EXT ? state.isDisjoint : null),
  };
  return {
    renderer: { getContext: () => context } as unknown as THREE.WebGLRenderer,
    advanceGpu: (ms: number) => (gpuNs += ms * 1e6),
    resolve: () => live.forEach((query) => (query.isAvailable = true)),
    liveQueries: () => live.size,
    state,
  };
}

function profiled() {
  const renderer = cpuOnlyRenderer();
  const clock = manualClock();
  const published: FrameStats[] = [];
  const profile = startFrameProfile(renderer, (stats) => published.push(stats), clock.now);
  return { renderer, clock, published, profile };
}

describe('startFrameProfile', () => {
  it('publishes the frame rate and the mean frame interval once a window of frames has passed', () => {
    const { clock, published, profile } = profiled();
    for (let frame = 0; frame <= 30; frame++) {
      profile.beginFrame(frame * 20);
      clock.advance(4);
      profile.endFrame();
    }
    expect(published).toHaveLength(1);
    expect(published[0]!.frameMs).toBe(20);
    expect(published[0]!.fps).toBe(50);
    expect(published[0]!.cpuMs).toBe(4);
  });

  it('gives each step its own time, without the time of the steps nested in it', () => {
    const { renderer, clock, published, profile } = profiled();
    for (let frame = 0; frame <= 30; frame++) {
      profile.beginFrame(frame * 20);
      clock.advance(1);
      beginStep(renderer, 'Scene draw');
      clock.advance(2);
      beginStep(renderer, 'Shadows');
      clock.advance(3);
      endStep(renderer, 'Shadows');
      clock.advance(2);
      endStep(renderer, 'Scene draw');
      clock.advance(1);
      profile.endFrame();
    }
    const steps = published[0]!.steps;
    expect(steps.map((s) => [s.step, s.cpuMs, s.callsPerFrame])).toEqual([
      ['Scene draw', 4, 1],
      ['Shadows', 3, 1],
      ['Other', 2, 1],
    ]);
    expect(published[0]!.cpuMs).toBe(9);
  });

  it('counts a step that runs several times in a frame once per run', () => {
    const { renderer, clock, published, profile } = profiled();
    for (let frame = 0; frame <= 30; frame++) {
      profile.beginFrame(frame * 20);
      for (let run = 0; run < 3; run++) {
        beginStep(renderer, 'Shadows');
        clock.advance(1);
        endStep(renderer, 'Shadows');
      }
      profile.endFrame();
    }
    const shadows = published[0]!.steps.find((s) => s.step === 'Shadows');
    expect(shadows).toMatchObject({ cpuMs: 3, callsPerFrame: 3 });
  });

  it('reports no GPU time when the context offers no timer query', () => {
    const { published, profile } = profiled();
    for (let frame = 0; frame <= 30; frame++) {
      profile.beginFrame(frame * 20);
      profile.endFrame();
    }
    expect(published[0]).toMatchObject({ hasGpuTimer: false, gpuMs: null });
  });

  it('records nothing once stopped', () => {
    const { renderer, published, profile } = profiled();
    profile.stop();
    for (let frame = 0; frame <= 30; frame++) {
      profile.beginFrame(frame * 20);
      beginStep(renderer, 'Shadows');
      endStep(renderer, 'Shadows');
      profile.endFrame();
    }
    expect(published).toEqual([]);
  });

  it('ignores a step marked outside a frame, such as a screenshot render', () => {
    const { renderer, clock, published, profile } = profiled();
    beginStep(renderer, 'Scene draw');
    clock.advance(50);
    endStep(renderer, 'Scene draw');
    for (let frame = 0; frame <= 30; frame++) {
      profile.beginFrame(frame * 20);
      clock.advance(1);
      profile.endFrame();
    }
    expect(published[0]!.steps.map((s) => s.step)).toEqual(['Other']);
  });

  it('closes a step left open by a throw when the frame ends', () => {
    const { renderer, clock, published, profile } = profiled();
    for (let frame = 0; frame <= 30; frame++) {
      profile.beginFrame(frame * 20);
      beginStep(renderer, 'Fog');
      clock.advance(1);
      profile.endFrame();
      clock.advance(5);
    }
    expect(published[0]!.steps.find((s) => s.step === 'Fog')!.cpuMs).toBe(1);
  });
});

describe('beginStep', () => {
  it('counts a step that a render inside it runs again as one run, with all its time', () => {
    const { renderer, clock, published, profile } = profiled();
    for (let frame = 0; frame <= 30; frame++) {
      profile.beginFrame(frame * 20);
      beginStep(renderer, 'Fog');
      clock.advance(1);
      beginStep(renderer, 'Shadows');
      clock.advance(2);
      beginStep(renderer, 'Fog');
      clock.advance(3);
      endStep(renderer, 'Fog');
      endStep(renderer, 'Shadows');
      endStep(renderer, 'Fog');
      profile.endFrame();
    }
    expect(published[0]!.steps.map((s) => [s.step, s.cpuMs, s.callsPerFrame])).toEqual([
      ['Shadows', 2, 1],
      ['Fog', 4, 1],
      ['Other', 0, 1],
    ]);
  });

  it('does nothing on a renderer with no profile', () => {
    const renderer = cpuOnlyRenderer();
    expect(() => {
      beginStep(renderer, 'Shadows');
      endStep(renderer, 'Shadows');
    }).not.toThrow();
  });
});

describe('endStep', () => {
  it('leaves the open step running when it names another step', () => {
    const { renderer, clock, published, profile } = profiled();
    for (let frame = 0; frame <= 30; frame++) {
      profile.beginFrame(frame * 20);
      beginStep(renderer, 'Scene draw');
      endStep(renderer, 'Shadows');
      clock.advance(2);
      endStep(renderer, 'Scene draw');
      profile.endFrame();
    }
    expect(published[0]!.steps.find((s) => s.step === 'Scene draw')!.cpuMs).toBe(2);
  });
});

describe('startFrameProfile on a context with a GPU timer', () => {
  function gpuProfiled() {
    const gpu = timerContext();
    const clock = manualClock();
    const published: FrameStats[] = [];
    const profile = startFrameProfile(gpu.renderer, (stats) => published.push(stats), clock.now);
    /** A frame of 1 ms GPU outside every step, 4 ms in Shadows, and 2 ms in Fog nested in it. */
    const runFrame = (frame: number) => {
      profile.beginFrame(frame * 20);
      gpu.advanceGpu(1);
      beginStep(gpu.renderer, 'Shadows');
      gpu.advanceGpu(4);
      beginStep(gpu.renderer, 'Fog');
      gpu.advanceGpu(2);
      endStep(gpu.renderer, 'Fog');
      endStep(gpu.renderer, 'Shadows');
      profile.endFrame();
    };
    return { gpu, published, profile, runFrame };
  }

  it("gives each step its own GPU time once the frame's results arrive", () => {
    const { gpu, published, runFrame } = gpuProfiled();
    for (let frame = 0; frame <= 30; frame++) {
      runFrame(frame);
      gpu.resolve();
    }
    expect(published[0]!.gpuMs).toBe(7);
    expect(published[0]!.steps.map((s) => [s.step, s.gpuMs])).toEqual([
      ['Shadows', 4],
      ['Fog', 2],
      ['Other', 1],
    ]);
  });

  it('runs one timer query at a time, as WebGL allows', () => {
    const { gpu, runFrame } = gpuProfiled();
    for (let frame = 0; frame <= 30; frame++) runFrame(frame);
    expect(gpu.state.overlaps).toBe(0);
  });

  it('reports a GPU timer with no time while no result has arrived', () => {
    const { published, runFrame } = gpuProfiled();
    for (let frame = 0; frame <= 30; frame++) runFrame(frame);
    expect(published[0]).toMatchObject({ hasGpuTimer: true, gpuMs: null });
  });

  it('drops the results of a frame the GPU timer marks disjoint', () => {
    const { gpu, published, runFrame } = gpuProfiled();
    gpu.state.isDisjoint = true;
    for (let frame = 0; frame <= 30; frame++) {
      runFrame(frame);
      gpu.resolve();
    }
    expect(published[0]!.gpuMs).toBeNull();
  });

  it('deletes every query it made once stopped', () => {
    const { gpu, profile, runFrame } = gpuProfiled();
    for (let frame = 0; frame <= 30; frame++) runFrame(frame);
    profile.stop();
    expect(gpu.liveQueries()).toBe(0);
  });
});

describe('innermostStep', () => {
  it('names the innermost open step', () => {
    const { renderer, profile } = profiled();
    profile.beginFrame(0);
    beginStep(renderer, 'Compositor');
    beginStep(renderer, 'Scene draw');
    expect(innermostStep(renderer)).toBe('Scene draw');
  });

  it('is null in a frame with no step open', () => {
    const { renderer, profile } = profiled();
    profile.beginFrame(0);
    expect(innermostStep(renderer)).toBeNull();
  });

  it('is null on a renderer with no profile (edge case)', () => {
    expect(innermostStep(cpuOnlyRenderer())).toBeNull();
  });
});
