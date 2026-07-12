/**
 * usePlaybackLoop — the shared transport→mixer per-frame loop driving both
 * AnimationPlayer and the GLB animation driver.
 *
 * PERF (WI-213): reportTime() is throttled inside AnimationTransportContext,
 * so a stale-but-throttled `time` would otherwise persist forever once
 * playback pauses (the 'paused' branch below never calls reportTime again on
 * its own). This pins that the loop flushes the mixer's exact current time
 * IMMEDIATELY on the playing → paused edge — and does NOT flush on the
 * playing → stopped edge, where transport stop()/deselection already reset
 * the playhead to 0 and a flush would overwrite that reset.
 */
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { flushTimeOnPauseEdge, usePlaybackLoop, type PlaybackLoopParams } from './usePlaybackLoop';
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
  configureAction,
  reconfigureKey,
}: {
  playState: PlayState;
  transportTime: number;
  reportTime: PlaybackLoopParams['reportTime'];
  mixerBox: { mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction> };
  configureAction?: PlaybackLoopParams['configureAction'];
  reconfigureKey?: unknown;
}) {
  const mixerRef = useRef(mixerBox.mixer);
  const actionsRef = useRef(mixerBox.actions);
  usePlaybackLoop({
    playState,
    selectedClip: 'clip',
    transportTime,
    mixerRef,
    actionsRef,
    configureAction: configureAction ?? (() => {}),
    reconfigureKey,
    reportTime,
    restore: () => {},
  });
  return null;
}

describe('usePlaybackLoop — reportTime flush on the playing → paused edge (WI-213)', () => {
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

  it('does NOT flush on the playing -> stopped transition — stop() already reset the playhead', async () => {
    // Every stopped transition (transport stop(), deselection's registerPlayer
    // cleanup) resets transport.time to 0; flushing the pre-stop playhead here
    // would overwrite that reset and leave the scrubber/timecode stuck at the
    // old time while the pose shows the authored rest state.
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
    await renderer.advanceFrames(2, 0.1);

    expect(reportTime).not.toHaveBeenCalled();
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

describe('usePlaybackLoop — reconfigureKey (#224 live loop-override)', () => {
  it('calls configureAction once on mount, but not again on unrelated re-renders', async () => {
    const configureAction = vi.fn();
    const mixerBox = makeMixer();
    const renderer = await ReactThreeTestRenderer.create(
      <Harness
        playState="playing"
        transportTime={0}
        reportTime={() => {}}
        mixerBox={mixerBox}
        configureAction={configureAction}
        reconfigureKey="auto"
      />
    );
    await renderer.advanceFrames(1, 0.1);
    configureAction.mockClear();

    // Same reconfigureKey, same clip — no reason to reconfigure again.
    await renderer.advanceFrames(3, 0.1);
    expect(configureAction).not.toHaveBeenCalled();
  });

  it('reconfigures the ACTIVE action when reconfigureKey changes mid-clip, without restarting it', async () => {
    const configureAction = vi.fn();
    const mixerBox = makeMixer();
    const renderer = await ReactThreeTestRenderer.create(
      <Harness
        playState="playing"
        transportTime={0}
        reportTime={() => {}}
        mixerBox={mixerBox}
        configureAction={configureAction}
        reconfigureKey="auto"
      />
    );
    await renderer.advanceFrames(2, 0.1); // action.time is now ~0.2
    configureAction.mockClear();

    await renderer.update(
      <Harness
        playState="playing"
        transportTime={0}
        reportTime={() => {}}
        mixerBox={mixerBox}
        configureAction={configureAction}
        reconfigureKey="once" // the override flipped — must re-apply now
      />
    );
    await renderer.advanceFrames(1, 0.1);

    expect(configureAction).toHaveBeenCalledTimes(1);
    expect(configureAction).toHaveBeenCalledWith(mixerBox.actions.get('clip'), 'clip');
    // The clip kept playing through the reconfigure — it was not restarted.
    expect(mixerBox.actions.get('clip')!.time).toBeGreaterThan(0.2);
  });
});

describe('flushTimeOnPauseEdge (the shared WI-213 edge-flush contract)', () => {
  it('flushes the exact time, unthrottled, on the playing → paused edge', () => {
    const reportTime = vi.fn();
    flushTimeOnPauseEdge('playing', 'paused', () => 0.42, reportTime);
    expect(reportTime).toHaveBeenCalledTimes(1);
    expect(reportTime).toHaveBeenCalledWith(0.42, { immediate: true });
  });

  it('does nothing when playback stays playing, was not playing before, or STOPS', () => {
    const reportTime = vi.fn();
    flushTimeOnPauseEdge('playing', 'playing', () => 0.42, reportTime);
    // stopped: stop()/deselection reset the playhead to 0 — a flush here
    // would overwrite that reset (the stuck-scrubber bug).
    flushTimeOnPauseEdge('playing', 'stopped', () => 0.42, reportTime);
    flushTimeOnPauseEdge('paused', 'stopped', () => 0.42, reportTime);
    flushTimeOnPauseEdge('stopped', 'stopped', () => 0.42, reportTime);
    expect(reportTime).not.toHaveBeenCalled();
  });

  it('does nothing when the driver has no live playhead (getTime → null)', () => {
    const reportTime = vi.fn();
    flushTimeOnPauseEdge('playing', 'paused', () => null, reportTime);
    expect(reportTime).not.toHaveBeenCalled();
  });
});
