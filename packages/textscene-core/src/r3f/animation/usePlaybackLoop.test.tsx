/**
 * usePlaybackLoop — the shared transport→mixer per-frame loop driving both
 * AnimationPlayer and the GLB animation driver.
 *
 * PERF (WI-213): reportTime() is throttled inside AnimationTransportContext,
 * so a stale-but-throttled `time` would otherwise persist forever once
 * playback stops being 'playing' (the 'paused'/'stopped' branches below never
 * call reportTime again on their own). This pins that the loop flushes the
 * mixer's exact current time IMMEDIATELY on the playing → non-playing edge.
 */
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { usePlaybackLoop, type PlaybackLoopParams } from './usePlaybackLoop';
import type { PlayState } from '../contexts/AnimationTransportContext';

/** A mixer + single 1s clip on a movable object, matching the driver shape. */
function makeMixer(): { mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction> } {
  const target = new THREE.Object3D();
  target.name = 'Mover';
  const clip = new THREE.AnimationClip('clip', 1, [
    new THREE.VectorKeyframeTrack('Mover.position', [0, 1], [0, 0, 0, 10, 0, 0]),
  ]);
  const mixer = new THREE.AnimationMixer(target);
  const action = mixer.clipAction(clip);
  return { mixer, actions: new Map([['clip', action]]) };
}

function Harness({
  playState,
  transportTime,
  reportTime,
  mixerBox,
}: {
  playState: PlayState;
  transportTime: number;
  reportTime: PlaybackLoopParams['reportTime'];
  mixerBox: { mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction> };
}) {
  const mixerRef = useRef(mixerBox.mixer);
  const actionsRef = useRef(mixerBox.actions);
  usePlaybackLoop({
    playState,
    selectedClip: 'clip',
    transportTime,
    mixerRef,
    actionsRef,
    configureAction: () => {},
    reportTime,
    restore: () => {},
  });
  return null;
}

describe('usePlaybackLoop — reportTime flush on the playing → non-playing edge (WI-213)', () => {
  it('reports the playhead every frame while playing', async () => {
    const reportTime = vi.fn();
    const mixerBox = makeMixer();
    const renderer = await ReactThreeTestRenderer.create(
      <Harness playState="playing" transportTime={0} reportTime={reportTime} mixerBox={mixerBox} />
    );

    reportTime.mockClear();
    await renderer.advanceFrames(3, 0.1);
    expect(reportTime).toHaveBeenCalledTimes(3);
  });

  it('flushes the exact mixer time immediately on the playing -> paused transition', async () => {
    const reportTime = vi.fn();
    const mixerBox = makeMixer();

    const renderer = await ReactThreeTestRenderer.create(
      <Harness playState="playing" transportTime={0} reportTime={reportTime} mixerBox={mixerBox} />
    );
    await renderer.advanceFrames(3, 0.1); // action.time is now ~0.3

    reportTime.mockClear();
    await renderer.update(
      <Harness playState="paused" transportTime={0.3} reportTime={reportTime} mixerBox={mixerBox} />
    );
    await renderer.advanceFrames(1, 0.1);

    // Exactly one flush call, carrying the immediate flag, with the mixer's
    // actual (not throttle-stale) time.
    expect(reportTime).toHaveBeenCalledTimes(1);
    const [time, options] = reportTime.mock.calls[0]!;
    expect(time).toBeCloseTo(0.3, 1);
    expect(options).toEqual({ immediate: true });
  });

  it('flushes immediately on the playing -> stopped transition too', async () => {
    const reportTime = vi.fn();
    const mixerBox = makeMixer();

    const renderer = await ReactThreeTestRenderer.create(
      <Harness playState="playing" transportTime={0} reportTime={reportTime} mixerBox={mixerBox} />
    );
    await renderer.advanceFrames(2, 0.1);

    reportTime.mockClear();
    await renderer.update(
      <Harness playState="stopped" transportTime={0} reportTime={reportTime} mixerBox={mixerBox} />
    );
    await renderer.advanceFrames(1, 0.1);

    expect(reportTime).toHaveBeenCalledTimes(1);
    const [, options] = reportTime.mock.calls[0]!;
    expect(options).toEqual({ immediate: true });
  });

  it('does not flush again on subsequent paused frames (no external seek)', async () => {
    const reportTime = vi.fn();
    const mixerBox = makeMixer();

    const renderer = await ReactThreeTestRenderer.create(
      <Harness playState="playing" transportTime={0} reportTime={reportTime} mixerBox={mixerBox} />
    );
    await renderer.advanceFrames(2, 0.1);
    await renderer.update(
      <Harness playState="paused" transportTime={0.2} reportTime={reportTime} mixerBox={mixerBox} />
    );
    await renderer.advanceFrames(1, 0.1); // consumes the one-shot flush

    reportTime.mockClear();
    await renderer.advanceFrames(3, 0.1); // still paused, no seek
    expect(reportTime).not.toHaveBeenCalled();
  });
});
