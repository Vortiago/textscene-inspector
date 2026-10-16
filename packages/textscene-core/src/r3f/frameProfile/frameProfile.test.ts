import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { beginStep, endStep, innermostStep, startFrameProfile } from './frameProfile';
import type { FrameStats } from './frameStats';
import {
  cpuOnlyRenderer,
  profiledRendererMembers,
  FRAME_INTERVAL_MS,
  FRAMES_PER_WINDOW,
  manualClock,
  profiledWindow,
  stepCpuMs,
} from './frameProfile.testkit';

/**
 * A WebGL 2 context with the timer query extension, whose queries measure a GPU clock the test moves
 * by hand. A query's result arrives once the test calls `resolve`. A lost context makes no query, and
 * a query from before a loss never resolves, as a browser's does.
 */
function timerContext() {
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

/** A CPU-only renderer, its clock, and a window helper that profiles it. */
function cpuOnly() {
  const renderer = cpuOnlyRenderer();
  const clock = manualClock();
  return { renderer, clock, window: (frame: () => void) => profiledWindow(renderer, clock.now, frame) };
}

describe('startFrameProfile', () => {
  it('publishes the frame rate and the mean frame interval once a window of frames has passed', () => {
    const { clock, window } = cpuOnly();
    const stats = window(() => clock.advance(4));
    expect(stats).toMatchObject({ frameMs: 20, fps: 50, cpuMs: 4 });
  });

  it('publishes nothing before a window of frames has passed (edge case)', () => {
    const published: FrameStats[] = [];
    const profile = startFrameProfile(
      cpuOnlyRenderer(),
      (stats) => published.push(stats),
      () => 0
    );
    for (let frame = 0; frame < FRAMES_PER_WINDOW - 1; frame++) {
      profile.beginFrame(frame * FRAME_INTERVAL_MS);
      profile.endFrame();
    }
    expect(published).toEqual([]);
  });

  it('gives each step its own time, without the time of the steps nested in it', () => {
    const { renderer, clock, window } = cpuOnly();
    const stats = window(() => {
      clock.advance(1);
      beginStep(renderer, 'Scene draw');
      clock.advance(2);
      beginStep(renderer, 'Shadows');
      clock.advance(3);
      endStep(renderer, 'Shadows');
      clock.advance(2);
      endStep(renderer, 'Scene draw');
      clock.advance(1);
    });
    expect(stepCpuMs(stats)).toEqual([
      ['Scene draw', 4],
      ['Shadows', 3],
      ['Other', 2],
    ]);
    expect(stats.cpuMs).toBe(9);
  });

  it('counts a step that runs several times in a frame once per run', () => {
    const { renderer, clock, window } = cpuOnly();
    const stats = window(() => {
      for (let run = 0; run < 3; run++) {
        beginStep(renderer, 'Shadows');
        clock.advance(1);
        endStep(renderer, 'Shadows');
      }
    });
    expect(stats.steps.find((s) => s.step === 'Shadows')).toMatchObject({ cpuMs: 3, runsPerFrame: 3 });
  });

  it("counts each step's own draw calls per frame, and the frame's", () => {
    const { renderer, window } = cpuOnly();
    const stats = window(() => {
      renderer.info.render.calls += 1;
      beginStep(renderer, 'Scene draw');
      renderer.info.render.calls += 5;
      beginStep(renderer, 'Shadows');
      renderer.info.render.calls += 3;
      endStep(renderer, 'Shadows');
      endStep(renderer, 'Scene draw');
    });
    expect(stats.steps.map((s) => [s.step, s.drawCallsPerFrame])).toEqual([
      ['Scene draw', 5],
      ['Shadows', 3],
      ['Other', 1],
    ]);
    expect(stats.drawCallsPerFrame).toBe(9);
  });

  it("keeps the count across a frame's renders, which three's renderer resets per render", () => {
    const renderer = cpuOnlyRenderer();
    startFrameProfile(renderer, () => {});
    expect(renderer.info.autoReset).toBe(false);
  });

  it("leaves the renderer's count resetting per render once stopped (error case)", () => {
    const renderer = cpuOnlyRenderer();
    startFrameProfile(renderer, () => {});
    startFrameProfile(renderer, () => {}).stop();
    expect(renderer.info.autoReset).toBe(true);
  });

  it('reports no GPU time when the context offers no timer query', () => {
    const { window } = cpuOnly();
    expect(window(() => {})).toMatchObject({ hasGpuTimer: false, gpuMs: null });
  });

  it('records nothing once stopped (error case)', () => {
    const renderer = cpuOnlyRenderer();
    const published: FrameStats[] = [];
    const profile = startFrameProfile(
      renderer,
      (stats) => published.push(stats),
      () => 0
    );
    profile.stop();
    for (let frame = 0; frame < FRAMES_PER_WINDOW; frame++) {
      profile.beginFrame(frame * FRAME_INTERVAL_MS);
      beginStep(renderer, 'Shadows');
      endStep(renderer, 'Shadows');
      profile.endFrame();
    }
    expect(published).toEqual([]);
  });

  it('closes a step left open by a throw when the frame ends', () => {
    const { renderer, clock, window } = cpuOnly();
    const stats = window(() => {
      beginStep(renderer, 'Fog');
      clock.advance(1);
    });
    expect(stats.steps.find((s) => s.step === 'Fog')!.cpuMs).toBe(1);
  });
});

describe('beginStep', () => {
  it('ignores a step marked outside a frame, such as a screenshot render', () => {
    const { renderer, clock, window } = cpuOnly();
    const stats = window(() => clock.advance(1));
    beginStep(renderer, 'Scene draw');
    clock.advance(50);
    endStep(renderer, 'Scene draw');
    expect(stepCpuMs(stats)).toEqual([['Other', 1]]);
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
    const { renderer, clock, window } = cpuOnly();
    const stats = window(() => {
      beginStep(renderer, 'Scene draw');
      endStep(renderer, 'Shadows');
      clock.advance(2);
      endStep(renderer, 'Scene draw');
    });
    expect(stats.steps.find((s) => s.step === 'Scene draw')!.cpuMs).toBe(2);
  });
});

describe('innermostStep', () => {
  function inFrame() {
    const renderer = cpuOnlyRenderer();
    startFrameProfile(renderer, () => {}).beginFrame(0);
    return renderer;
  }

  it('names the innermost open step', () => {
    const renderer = inFrame();
    beginStep(renderer, 'Compositor');
    beginStep(renderer, 'Scene draw');
    expect(innermostStep(renderer)).toBe('Scene draw');
  });

  it('is null in a frame with no step open', () => {
    expect(innermostStep(inFrame())).toBeNull();
  });

  it('is null on a renderer with no profile (edge case)', () => {
    expect(innermostStep(cpuOnlyRenderer())).toBeNull();
  });
});

describe('startFrameProfile on a context with a GPU timer', () => {
  /** A frame of 1 ms GPU outside every step, 4 ms in Shadows, and 2 ms in Fog nested in it. */
  function gpuFrame(gpu: ReturnType<typeof timerContext>): void {
    gpu.advanceGpu(1);
    beginStep(gpu.renderer, 'Shadows');
    gpu.advanceGpu(4);
    beginStep(gpu.renderer, 'Fog');
    gpu.advanceGpu(2);
    endStep(gpu.renderer, 'Fog');
    endStep(gpu.renderer, 'Shadows');
  }

  it("gives each step its own GPU time once the frame's results arrive", () => {
    const gpu = timerContext();
    const stats = profiledWindow(
      gpu.renderer,
      () => 0,
      () => {
        gpuFrame(gpu);
        gpu.resolve();
      }
    );
    expect(stats.gpuMs).toBe(7);
    expect(stats.steps.map((s) => [s.step, s.gpuMs])).toEqual([
      ['Shadows', 4],
      ['Fog', 2],
      ['Other', 1],
    ]);
  });

  it('runs one timer query at a time, as WebGL allows', () => {
    const gpu = timerContext();
    profiledWindow(
      gpu.renderer,
      () => 0,
      () => gpuFrame(gpu)
    );
    expect(gpu.state.overlaps).toBe(0);
  });

  it('reports a GPU timer with no time while no result has arrived', () => {
    const gpu = timerContext();
    const stats = profiledWindow(
      gpu.renderer,
      () => 0,
      () => gpuFrame(gpu)
    );
    expect(stats).toMatchObject({ hasGpuTimer: true, gpuMs: null });
  });

  it('drops the results of a frame the GPU timer marks disjoint (error case)', () => {
    const gpu = timerContext();
    gpu.state.isDisjoint = true;
    const stats = profiledWindow(
      gpu.renderer,
      () => 0,
      () => {
        gpuFrame(gpu);
        gpu.resolve();
      }
    );
    expect(stats.gpuMs).toBeNull();
  });

  it('deletes every query it made once stopped', () => {
    const gpu = timerContext();
    profiledWindow(
      gpu.renderer,
      () => 0,
      () => gpuFrame(gpu)
    );
    expect(gpu.liveQueries()).toBe(0);
  });
  it('times nothing while the context is lost, and times a restored context with new queries (error case)', () => {
    const gpu = timerContext();
    const published: FrameStats[] = [];
    const profile = startFrameProfile(
      gpu.renderer,
      (stats) => published.push(stats),
      () => 0
    );
    let timestamp = 0;
    const runFrames = (count: number) => {
      for (let frame = 0; frame < count; frame++) {
        profile.beginFrame(timestamp);
        gpuFrame(gpu);
        profile.endFrame();
        gpu.resolve();
        timestamp += FRAME_INTERVAL_MS;
      }
    };
    runFrames(3);
    gpu.loseContext();
    expect(() => runFrames(3)).not.toThrow();
    gpu.restoreContext();
    published.length = 0;
    runFrames(FRAMES_PER_WINDOW);
    profile.stop();

    expect(gpu.state.staleBegins).toBe(0);
    expect(published.at(-1)!.gpuMs).toBe(7);
  });

  it("lists a step whose GPU result arrives in a window it did not run in, so the rows sum to the frame's GPU time", () => {
    const gpu = timerContext();
    const published: FrameStats[] = [];
    const profile = startFrameProfile(
      gpu.renderer,
      (stats) => published.push(stats),
      () => 0
    );
    for (let frame = 0; frame < FRAMES_PER_WINDOW; frame++) {
      profile.beginFrame(frame * FRAME_INTERVAL_MS);
      gpu.advanceGpu(1);
      if (frame === FRAMES_PER_WINDOW - 1) {
        beginStep(gpu.renderer, 'Reflection probes');
        gpu.advanceGpu(5);
        endStep(gpu.renderer, 'Reflection probes');
      }
      profile.endFrame();
      gpu.resolve();
    }
    for (let frame = FRAMES_PER_WINDOW; frame < 2 * FRAMES_PER_WINDOW - 1; frame++) {
      profile.beginFrame(frame * FRAME_INTERVAL_MS);
      profile.endFrame();
    }
    profile.stop();

    const [, second] = published;
    expect(second!.steps.map((s) => [s.step, s.gpuMs, s.runsPerFrame])).toEqual([
      ['Reflection probes', 5, 0],
      ['Other', 1, 1],
    ]);
  });
});
