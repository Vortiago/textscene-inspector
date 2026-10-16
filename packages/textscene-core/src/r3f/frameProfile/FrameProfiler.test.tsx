import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useFrame } from '@react-three/fiber';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { RendererProbe } from '../../testing/recordingWebGL';
import { FrameStatsProvider, useFrameStatsStore } from './FrameStatsContext';
import { FrameProfiler, SubscriberStep } from './FrameProfiler';
import { innermostStep, startFrameProfile } from './frameProfile';
import type { FrameStats } from './frameStats';

const STATS: FrameStats = {
  fps: 50,
  frameMs: 20,
  cpuMs: 4,
  gpuMs: null,
  hasGpuTimer: false,
  steps: [],
};

/** A canvas with `<FrameProfiler>` under a toggle set to `showPerformance`, seeded with a window. */
async function profiledCanvas(showPerformance: boolean) {
  let store: ReturnType<typeof useFrameStatsStore> | undefined;
  function StoreProbe() {
    store = useFrameStatsStore();
    return null;
  }
  const root = await ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowPerformance={showPerformance}>
      <FrameStatsProvider>
        <StoreProbe />
        <FrameProfiler />
      </FrameStatsProvider>
    </ViewportModeProvider>
  );
  store!.set(STATS);
  return { store: store!, unmount: () => root.unmount() };
}

describe('FrameProfiler', () => {
  it('clears the published window once it unmounts, so the overlay shows no stale numbers', async () => {
    const { store, unmount } = await profiledCanvas(true);
    await unmount();
    expect(store.get()).toBeNull();
  });

  it('runs no profile while the toggle is off, so it leaves the store alone (edge case)', async () => {
    const { store, unmount } = await profiledCanvas(false);
    await unmount();
    expect(store.get()).toBe(STATS);
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
      <ViewportModeProvider initialShowPerformance={showPerformance}>
        <RendererProbe onRenderer={(found) => (renderer = found)} />
        <SubscriberStep step="Compositor" priority={1} />
        <Subscriber />
      </ViewportModeProvider>
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
