import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { beginStep, endStep, recordFrames, startFrameCount, type FrameProfile } from './frameProfile';
import type { FrameRecording } from './frameStats';
import { timeEachDraw } from './frameRecording';
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
    expect(recording!.storedDepthRead).toBe('fetched');
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

  it('refuses a count of frames it cannot average an interval over (error case)', () => {
    timed(cpuOnlyRenderer());
    expect(() => recordFrames({ frames: 1 })).toThrow('expected a whole count of 2 frames or more, got 1');
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
      { step: 'Scene draw', object: 'Floor', material: 'ground.gdshader', gpuMs: 4, callsPerFrame: 2 },
      { step: 'Scene draw', object: 'Wall', material: 'ground.gdshader', gpuMs: 2, callsPerFrame: 1 },
      { step: 'Shadows', object: 'Wall', material: 'MeshDepthMaterial', gpuMs: 2, callsPerFrame: 1 },
    ]);
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
      { step: 'Other', object: 'Floor', material: 'MeshBasicMaterial', gpuMs: null, callsPerFrame: 1 },
    ]);
  });
});

describe('timeEachDraw', () => {
  it("restores the renderer's own draw once removed", () => {
    const renderer = cpuOnlyRenderer();
    const own = () => {};
    renderer.renderBufferDirect = own;
    timeEachDraw(
      renderer,
      () => {},
      () => {}
    )();
    expect(renderer.renderBufferDirect).toBe(own);
  });

  it('keeps a hook installed over it, which still calls it (edge case)', () => {
    const renderer = cpuOnlyRenderer();
    renderer.renderBufferDirect = () => {};
    const remove = timeEachDraw(
      renderer,
      () => {},
      () => {}
    );
    const over: THREE.WebGLRenderer['renderBufferDirect'] = () => {};
    renderer.renderBufferDirect = over;
    remove();
    expect(renderer.renderBufferDirect).toBe(over);
  });
});
