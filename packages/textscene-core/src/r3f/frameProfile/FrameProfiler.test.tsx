import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useFrame } from '@react-three/fiber';
import { ViewShowProvider } from '../viewShow/ViewShowContext';
import { RendererProbe } from '../../testing/recordingWebGL';
import { ViewStatusProvider } from '../viewStatus/ViewStatusContext';
import { createViewStatusStore } from '../viewStatus/viewStatus';
import { FrameProfiler, SubscriberStep } from './FrameProfiler';
import { innermostStep } from './frameProfile';
import type { FrameStats } from './frameStats';
import { FRAME_INTERVAL_MS, startFrameProfile } from './frameProfile.testkit';
import { r3fStateProbe } from '../testing/R3FStateProbe';

const FRAMES_IN_A_SECOND = 50;

const STATS: FrameStats = {
  fps: 50,
  frameMs: 20,
  cpuMs: 4,
  drawCallsPerFrame: 0,
  objectsPerFrame: 0,
  primitivesPerFrame: 0,
};

/** A canvas with `<FrameProfiler>` under a toggle set to `showPerformance`, seeded with a window. */
async function profiledCanvas(showPerformance: boolean) {
  const store = createViewStatusStore();
  const root = await ReactThreeTestRenderer.create(
    <ViewShowProvider show={{ performance: showPerformance }}>
      <ViewStatusProvider store={store}>
        <FrameProfiler />
      </ViewStatusProvider>
    </ViewShowProvider>
  );
  store.frameMeasured(STATS);
  return { store, unmount: () => root.unmount() };
}

describe('FrameProfiler', () => {
  it('clears the published window once it unmounts, so the overlay shows no stale numbers', async () => {
    const { store, unmount } = await profiledCanvas(true);
    await unmount();
    expect(store.status().frame).toBeNull();
  });

  it('publishes the frame numbers without timings while the toggle is off', async () => {
    const window = await publishedWindow(false);
    expect(window?.fps).toBe(50);
    expect(window).not.toHaveProperty('timings');
  });

  it('publishes the timings of each step while the toggle is on', async () => {
    expect((await publishedWindow(true))?.timings?.steps).toContainEqual(
      expect.objectContaining({ step: 'Other', runsPerFrame: 1 })
    );
  });
});

/** A canvas under a toggle set to `showPerformance`, whose frames a test draws by the second. */
async function profiledView(showPerformance: boolean) {
  const store = createViewStatusStore();
  const { Probe, state } = r3fStateProbe();
  const canvas = (performance: boolean) => (
    <ViewShowProvider show={{ performance }}>
      <ViewStatusProvider store={store}>
        <FrameProfiler />
        <Probe />
      </ViewStatusProvider>
    </ViewShowProvider>
  );
  const root = await ReactThreeTestRenderer.create(canvas(showPerformance));
  let drawn = 0;
  return {
    store,
    /** Draws a second of frames 20 ms apart. `advance` runs R3F's global effects, which mark them. */
    drawSecond() {
      for (let frame = 0; frame < FRAMES_IN_A_SECOND; frame++) state().advance(drawn++ * FRAME_INTERVAL_MS);
    },
    switchPerformance: (performance: boolean) => root.update(canvas(performance)),
    unmount: () => root.unmount(),
  };
}

/** The window a canvas's profile publishes over a second of frames. */
async function publishedWindow(showPerformance: boolean): Promise<FrameStats | null> {
  const view = await profiledView(showPerformance);
  view.drawSecond();
  const window = view.store.status().frame;
  await view.unmount();
  return window;
}

describe('a switch of show.performance', () => {
  it('keeps the last window of frame numbers, so status().frame never goes null', async () => {
    const view = await profiledView(false);
    view.drawSecond();
    const counted = view.store.status().frame;
    await view.switchPerformance(true);
    expect(view.store.status().frame).toBe(counted);
    await view.unmount();
  });

  it('adds the timings from the next window, and drops them once switched off', async () => {
    const view = await profiledView(false);
    view.drawSecond();
    await view.switchPerformance(true);
    view.drawSecond();
    expect(view.store.status().frame).toHaveProperty('timings');
    await view.switchPerformance(false);
    view.drawSecond();
    expect(view.store.status().frame).not.toHaveProperty('timings');
    await view.unmount();
  });
});

describe('SubscriberStep', () => {
  /** The innermost step a subscriber at `priority` sees, in a frame of a profile on the canvas. */
  async function stepSeenAt(priority: number, showPerformance: boolean): Promise<string | null> {
    let renderer: THREE.WebGLRenderer | undefined;
    let seen: string | null = null;
    function Subscriber() {
      useFrame(({ gl }) => (seen = innermostStep(gl)), priority);
      return null;
    }
    const root = await ReactThreeTestRenderer.create(
      <ViewShowProvider show={{ performance: showPerformance }}>
        <RendererProbe onRenderer={(found) => (renderer = found)} />
        <SubscriberStep step="Compositor" priority={1} />
        <Subscriber />
      </ViewShowProvider>
    );
    const profile = startFrameProfile(renderer!, () => {});
    profile.beginFrame(0);
    await root.advanceFrames(1, 16);
    profile.stop();
    await root.unmount();
    return seen;
  }

  it('times the subscribers at its priority as its step', async () => {
    expect(await stepSeenAt(1, true)).toBe('Compositor');
  });

  it('leaves a subscriber at another priority outside its step', async () => {
    expect(await stepSeenAt(2, true)).toBeNull();
  });

  it('marks nothing while the toggle is off (edge case)', async () => {
    expect(await stepSeenAt(1, false)).toBeNull();
  });
});
