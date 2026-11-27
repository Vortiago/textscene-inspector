import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { beginStep, endStep, recordFrames, startFrameCount, type FrameProfile } from './frameProfile';
import type { FrameRecording } from './frameStats';
import { addDrawGpuTime, DrawSources, Recording, timeEachDraw } from './frameRecording';
import {
  cpuOnlyRenderer,
  FRAME_INTERVAL_MS,
  manualClock,
  startFrameProfile,
  timerContext,
} from './frameProfile.testkit';

/** Every profile a test starts, stopped after it so `recordFrames` reaches none of another test's. */
const started: FrameProfile[] = [];

afterEach(() => {
  for (const profile of started.splice(0)) profile.stop();
});

function timed(renderer: THREE.WebGLRenderer, now: () => number = () => 0): FrameProfile {
  const profile = startFrameProfile(renderer, () => {}, now);
  started.push(profile);
  return profile;
}

/** Runs `count` frames of `profile`, from frame `first`, each running `frame`. */
function runFrames(profile: FrameProfile, first: number, count: number, frame: () => void = () => {}): void {
  for (let index = first; index < first + count; index++) {
    profile.beginFrame(index * FRAME_INTERVAL_MS);
    frame();
    profile.endFrame();
  }
}

/** A renderer with a GPU timer whose draw calls each take `drawMs` of GPU time. */
function drawingRenderer(drawMs: number) {
  const gpu = timerContext();
  const renderer = gpu.renderer;
  renderer.renderBufferDirect = () => gpu.advanceGpu(drawMs);
  return { gpu, renderer };
}

const WHOLE_GEOMETRY: THREE.GeometryGroup = { start: 0, count: Infinity };

function draw(renderer: THREE.WebGLRenderer, object: THREE.Object3D, material: THREE.Material): void {
  const camera = new THREE.Camera();
  renderer.renderBufferDirect(
    camera,
    new THREE.Scene(),
    new THREE.BufferGeometry(),
    material,
    object,
    WHOLE_GEOMETRY
  );
}

function steady(ms: number) {
  return { medianMs: ms, lowMs: ms, highMs: ms };
}

function named<T extends THREE.Object3D | THREE.Material>(thing: T, name: string): T {
  thing.name = name;
  return thing;
}

describe('recordFrames', () => {
  it('rejects while no view has Performance on (error case)', async () => {
    started.push(startFrameCount(cpuOnlyRenderer(), () => {}));
    await expect(recordFrames()).rejects.toThrow('expected a view with Performance on');
  });

  it("averages the overlay's numbers over the frames asked for, from the frame after the call", async () => {
    const clock = manualClock();
    const renderer = cpuOnlyRenderer();
    const profile = timed(renderer, clock.now);
    runFrames(profile, 0, 3, () => clock.advance(9));
    const recorded = recordFrames({ frames: 4 });
    runFrames(profile, 3, 4, () => {
      beginStep(renderer, 'Shadows');
      clock.advance(3);
      endStep(renderer, 'Shadows');
    });
    const [recording] = await recorded;
    expect(recording).toMatchObject({ frames: 4, frameMs: FRAME_INTERVAL_MS, cpuMs: 3 });
    expect(recording!.timings.steps.map((s) => [s.step, s.cpuMs])).toEqual([
      ['Shadows', 3],
      ['Other', 0],
    ]);
  });

  it("names the page's read of the sun's stored depth, which decides a soft shadow's cost", async () => {
    const profile = timed(cpuOnlyRenderer());
    const recorded = recordFrames({ frames: 2 });
    runFrames(profile, 0, 2);
    const [recording] = await recorded;
    expect(recording!.device.storedDepthRead).toBe('fetched');
  });

  it('records each timed renderer on the page', async () => {
    const first = timed(cpuOnlyRenderer());
    const second = timed(cpuOnlyRenderer());
    const recorded = recordFrames({ frames: 2 });
    runFrames(first, 0, 2);
    runFrames(second, 0, 2);
    expect(await recorded).toHaveLength(2);
  });

  it('rejects a recording once Performance turns off before its frames end (error case)', async () => {
    const profile = timed(cpuOnlyRenderer());
    const recorded = recordFrames({ frames: 10 });
    runFrames(profile, 0, 3);
    profile.stopTimings();
    await expect(recorded).rejects.toThrow('expected 10 recorded frames, got 3: Performance turned off');
  });

  it('rejects a recording once its view closes before its frames end (error case)', async () => {
    const profile = timed(cpuOnlyRenderer());
    const recorded = recordFrames({ frames: 10 });
    runFrames(profile, 0, 3);
    profile.stop();
    await expect(recorded).rejects.toThrow('expected 10 recorded frames, got 3: the view closed its profile');
  });

  it('runs two recordings of one view at once, each over its own frames', async () => {
    const profile = timed(cpuOnlyRenderer());
    const longer = recordFrames({ frames: 4 });
    runFrames(profile, 0, 2);
    const shorter = recordFrames({ frames: 2 });
    runFrames(profile, 2, 2);
    expect([(await longer)[0]!.frames, (await shorter)[0]!.frames]).toEqual([4, 2]);
  });

  it('records across a lost context, timing only the frames the GPU drew (error case)', async () => {
    const { gpu, renderer } = drawingRenderer(2);
    const profile = timed(renderer);
    const floor = named(new THREE.Mesh(), 'Floor');
    const recorded = recordFrames({ frames: 6, draws: true });
    const drawFrames = (first: number, count: number) =>
      runFrames(profile, first, count, () => {
        draw(renderer, floor, new THREE.MeshBasicMaterial());
        gpu.resolve();
      });
    drawFrames(0, 3);
    gpu.loseContext();
    drawFrames(3, 4);
    const [recording] = await recorded;
    expect(recording!.frames).toBe(6);
    expect(recording!.draws![0]!.gpuMs).toBe(2);
  });

  it('rejects a recording once its view stops drawing, as a hidden view does (error case)', async () => {
    vi.useFakeTimers();
    try {
      const profile = timed(cpuOnlyRenderer());
      const recorded = recordFrames({ frames: 10 });
      runFrames(profile, 0, 3);
      vi.runOnlyPendingTimers();
      await expect(recorded).rejects.toThrow('got 3: no frame in');
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a stalled recording, so it arms no stall timer once its view draws again (edge case)', async () => {
    vi.useFakeTimers();
    try {
      const profile = timed(cpuOnlyRenderer());
      const recorded = recordFrames({ frames: 10 });
      runFrames(profile, 0, 3);
      vi.runOnlyPendingTimers();
      await expect(recorded).rejects.toThrow('got 3: no frame in');
      runFrames(profile, 3, 2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a count of frames it cannot average an interval over (error case)', async () => {
    timed(cpuOnlyRenderer());
    await expect(recordFrames({ frames: 1 })).rejects.toThrow(
      'expected a whole count of 2 frames or more, got 1'
    );
  });

  it('leaves out the draws unless asked for', async () => {
    const { renderer } = drawingRenderer(1);
    const profile = timed(renderer);
    const recorded = recordFrames({ frames: 2 });
    runFrames(profile, 0, 2);
    expect((await recorded)[0]).not.toHaveProperty('draws');
  });
});

describe('recordFrames with draws', () => {
  /** Two frames: each draws the floor twice and a wall once in Scene draw, and the wall in Shadows. */
  async function recordedDraws(): Promise<FrameRecording> {
    const { gpu, renderer } = drawingRenderer(2);
    const profile = timed(renderer);
    const floor = named(new THREE.Mesh(), 'Floor');
    const wall = new THREE.Mesh();
    named(new THREE.Group(), 'Wall').add(wall);
    const lit = named(new THREE.MeshStandardMaterial(), 'ground.gdshader');
    const depth = new THREE.MeshDepthMaterial();
    const recorded = recordFrames({ frames: 2, draws: true });
    runFrames(profile, 0, 3, () => {
      beginStep(renderer, 'Scene draw');
      draw(renderer, floor, lit);
      draw(renderer, floor, lit);
      draw(renderer, wall, lit);
      beginStep(renderer, 'Shadows');
      draw(renderer, wall, depth);
      endStep(renderer, 'Shadows');
      endStep(renderer, 'Scene draw');
      gpu.resolve();
    });
    const [recording] = await recorded;
    return recording!;
  }

  it('gives each step, object and material its GPU time and calls per frame, slowest first', async () => {
    const { draws } = await recordedDraws();
    expect(draws).toEqual([
      {
        step: 'Scene draw',
        object: 'Floor',
        material: 'ground.gdshader',
        gpuMs: 4,
        gpuSpread: steady(4),
        callsPerFrame: 2,
      },
      {
        step: 'Scene draw',
        object: 'Wall',
        material: 'ground.gdshader',
        gpuMs: 2,
        gpuSpread: steady(2),
        callsPerFrame: 1,
      },
      {
        step: 'Shadows',
        object: 'Wall',
        material: 'MeshDepthMaterial',
        gpuMs: 2,
        gpuSpread: steady(2),
        callsPerFrame: 1,
      },
    ]);
  });

  it("leaves the frames drawn before the recording, whose GPU times arrive late, out of each draw's time", async () => {
    const { gpu, renderer } = drawingRenderer(2);
    const profile = timed(renderer);
    const floor = named(new THREE.Mesh(), 'Floor');
    runFrames(profile, 0, 3, () => draw(renderer, floor, new THREE.MeshBasicMaterial()));
    const recorded = recordFrames({ frames: 4, draws: true });
    runFrames(profile, 3, 5, () => {
      draw(renderer, floor, new THREE.MeshBasicMaterial());
      gpu.resolve();
    });
    const [recording] = await recorded;
    expect(recording!.draws![0]!.gpuMs).toBe(2);
  });

  it('times a clear as its own entry, named after the target it clears', async () => {
    const { gpu, renderer } = drawingRenderer(2);
    const atlas = new THREE.WebGLRenderTarget(4, 4);
    atlas.texture.name = 'DirectionalShadowAtlasColour';
    renderer.getRenderTarget = () => atlas;
    renderer.clear = () => gpu.advanceGpu(3);
    const profile = timed(renderer);
    const recorded = recordFrames({ frames: 2, draws: true });
    runFrames(profile, 0, 3, () => {
      beginStep(renderer, 'Shadows');
      renderer.clear();
      endStep(renderer, 'Shadows');
      gpu.resolve();
    });
    const [recording] = await recorded;
    expect(recording!.draws).toEqual([
      {
        step: 'Shadows',
        object: 'Clear',
        material: 'DirectionalShadowAtlasColour',
        gpuMs: 3,
        gpuSpread: steady(3),
        callsPerFrame: 1,
      },
    ]);
  });

  it('names a clear of a target whose texture has no name apart from the canvas (edge case)', async () => {
    const { gpu, renderer } = drawingRenderer(2);
    const cube = new THREE.WebGLCubeRenderTarget(4);
    renderer.getRenderTarget = () => cube;
    renderer.clear = () => gpu.advanceGpu(1);
    const profile = timed(renderer);
    const recorded = recordFrames({ frames: 2, draws: true });
    runFrames(profile, 0, 3, () => {
      renderer.clear();
      gpu.resolve();
    });
    const [recording] = await recorded;
    expect(recording!.draws![0]).toMatchObject({ object: 'Clear', material: 'unnamed target' });
  });

  it('names a clear of the canvas after the canvas (edge case)', async () => {
    const { gpu, renderer } = drawingRenderer(2);
    renderer.getRenderTarget = () => null;
    renderer.clear = () => gpu.advanceGpu(1);
    const profile = timed(renderer);
    const recorded = recordFrames({ frames: 2, draws: true });
    runFrames(profile, 0, 3, () => {
      renderer.clear();
      gpu.resolve();
    });
    const [recording] = await recorded;
    expect(recording!.draws![0]).toMatchObject({ object: 'Clear', material: 'canvas' });
  });

  it('keeps the steps summing to the frame GPU time while it times each draw', async () => {
    const { timings } = await recordedDraws();
    expect(timings.gpuMs).toBe(8);
    expect(timings.steps.map((s) => [s.step, s.gpuMs])).toEqual([
      ['Scene draw', 6],
      ['Shadows', 2],
      ['Other', 0],
    ]);
  });
});

describe('the spread of a recording', () => {
  it("gives each draw's 10th and 90th percentile over the frames, so a paste shows its noise", async () => {
    const { gpu, renderer } = drawingRenderer(0);
    const profile = timed(renderer);
    const floor = named(new THREE.Mesh(), 'Floor');
    let frame = 0;
    renderer.renderBufferDirect = () => gpu.advanceGpu(frame % 2 === 0 ? 1 : 3);
    const recorded = recordFrames({ frames: 10, draws: true });
    runFrames(profile, 0, 11, () => {
      frame += 1;
      draw(renderer, floor, new THREE.MeshBasicMaterial());
      gpu.resolve();
    });
    const [recording] = await recorded;
    expect(recording!.draws![0]!.gpuSpread).toMatchObject({ lowMs: 1, highMs: 3 });
    expect(recording!.gpuSpread).toMatchObject({ lowMs: 1, highMs: 3 });
  });
});

describe('recordFrames with draws and no timer query', () => {
  it('still counts the calls of each draw, with no GPU time', async () => {
    const renderer = cpuOnlyRenderer();
    renderer.renderBufferDirect = () => {};
    const profile = timed(renderer);
    const recorded = recordFrames({ frames: 2, draws: true });
    runFrames(profile, 0, 3, () =>
      draw(renderer, named(new THREE.Mesh(), 'Floor'), new THREE.MeshBasicMaterial())
    );
    const [recording] = await recorded;
    expect(recording!.draws).toEqual([
      {
        step: 'Other',
        object: 'Floor',
        material: 'MeshBasicMaterial',
        gpuMs: null,
        gpuSpread: null,
        callsPerFrame: 1,
      },
    ]);
  });
});

describe('timeEachDraw', () => {
  it("restores the renderer's own draw once removed", () => {
    const renderer = cpuOnlyRenderer();
    const own = () => {};
    const ownClear = () => {};
    renderer.renderBufferDirect = own;
    renderer.clear = ownClear;
    timeEachDraw(renderer, {
      beginDraw: () => {},
      beginClear: () => {},
      end: () => {},
    })();
    expect(renderer.renderBufferDirect).toBe(own);
    expect(renderer.clear).toBe(ownClear);
  });

  it('keeps a hook installed over it, which still calls it (edge case)', () => {
    const renderer = cpuOnlyRenderer();
    renderer.renderBufferDirect = () => {};
    renderer.clear = () => {};
    const remove = timeEachDraw(renderer, { beginDraw: () => {}, beginClear: () => {}, end: () => {} });
    const over: THREE.WebGLRenderer['renderBufferDirect'] = () => {};
    const overClear: THREE.WebGLRenderer['clear'] = () => {};
    renderer.renderBufferDirect = over;
    renderer.clear = overClear;
    remove();
    expect(renderer.renderBufferDirect).toBe(over);
    expect(renderer.clear).toBe(overClear);
  });
});

describe('DrawSources', () => {
  it('gives one source for each step, object and material', () => {
    const sources = new DrawSources();
    const floor = named(new THREE.Mesh(), 'Floor');
    const material = new THREE.MeshBasicMaterial();

    expect(sources.of('Shadows', floor, material)).toBe(sources.of('Shadows', floor, material));
  });

  it('names a material by its type when it has no name (edge case)', () => {
    const source = new DrawSources().of(
      'Other',
      named(new THREE.Mesh(), 'Floor'),
      new THREE.MeshBasicMaterial()
    );

    expect(source).toEqual({ step: 'Other', object: 'Floor', material: 'MeshBasicMaterial' });
  });

  it('tells the same object apart in another step', () => {
    const sources = new DrawSources();
    const floor = named(new THREE.Mesh(), 'Floor');
    const material = new THREE.MeshBasicMaterial();

    expect(sources.of('Shadows', floor, material)).not.toBe(sources.of('Other', floor, material));
  });

  it('tells a clear apart from an object named like one (edge case)', () => {
    const sources = new DrawSources();
    const material = new THREE.MeshBasicMaterial();
    material.name = 'canvas';

    expect(sources.ofClear('Other', null)).not.toBe(
      sources.of('Other', named(new THREE.Mesh(), 'Clear'), material)
    );
  });
});

describe('addDrawGpuTime', () => {
  const source = { step: 'Other', object: 'Floor', material: 'MeshBasicMaterial' } as const;

  /** Fails `recording` to clear its stall timer, with its rejection handled. */
  function close(recording: Recording): void {
    recording.result.catch(() => {});
    recording.fail('the test ended');
  }

  it('adds the time to each recording that times draws', () => {
    const recording = new Recording({ frames: 2, draws: true });
    addDrawGpuTime([recording], source, 5);
    addDrawGpuTime([recording], source, 3);
    close(recording);

    expect(recording.drawGpuNs.get(source)).toBe(8);
  });

  it('leaves a recording that does not time draws without draw times (edge case)', () => {
    const recording = new Recording({ frames: 2 });
    addDrawGpuTime([recording], source, 5);
    close(recording);

    expect(recording.drawGpuNs.size).toBe(0);
  });
});
