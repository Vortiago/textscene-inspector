/**
 * The transport-to-mixer playback loop of the AnimationPlayer (ADR-0011) and GLB
 * drivers: play advances and reports, pause samples the seek, stop restores the
 * pose. `stepPlayback` decides each frame, and this hook carries it out.
 */
import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { AnimationAction, AnimationMixer } from 'three';
import type { PlayState } from '../contexts/AnimationTransportContext';
import { stepPlayback } from './stepPlayback';
import { startAction, seekAction } from './actionHelpers';

export interface PlaybackLoopParams {
  playState: PlayState;
  selectedClip: string | null;
  transportTime: number;
  speedScale?: number;
  mixerRef: MutableRefObject<AnimationMixer | null>;
  actionsRef: MutableRefObject<Map<string, AnimationAction>>;
  /** Apply loop settings when a clip first becomes the selected action. */
  configureAction: (action: AnimationAction, clipName: string) => void;
  /**
   * A change (by `Object.is`) re-runs `configureAction` on the current action,
   * so a loop-override flip applies at once. Omitted, only a clip switch does.
   */
  reconfigureKey?: unknown;
  /**
   * Reports the playhead to the transport, which throttles it. The loop passes
   * `{ immediate: true }` once on the pause edge, so the paused readout is exact.
   */
  reportTime: (t: number, options?: { immediate?: boolean }) => void;
  /** Restore the authored pose when playback stops. */
  restore: () => void;
}

export function usePlaybackLoop(params: PlaybackLoopParams): void {
  const prevStateRef = useRef<PlayState>('stopped');
  const prevClipRef = useRef<string | null>(null);
  const prevTimeRef = useRef<number>(0);
  const prevReconfigureKeyRef = useRef<unknown>(undefined);

  useFrame((_, delta) => {
    const { playState, selectedClip, transportTime, mixerRef, actionsRef } = params;
    const speedScale = params.speedScale ?? 1;
    const mixer = mixerRef.current;
    if (!mixer) return;
    const action = selectedClip ? actionsRef.current.get(selectedClip) ?? null : null;

    // Clip switch: stop the previous action so only one drives at a time.
    const clipChanged = selectedClip !== prevClipRef.current;
    if (clipChanged) {
      const prev = prevClipRef.current ? actionsRef.current.get(prevClipRef.current) : null;
      prev?.stop();
      prevClipRef.current = selectedClip;
    }
    // Reconfigure on a clip switch or a reconfigureKey change, without
    // restarting the running action.
    const reconfigureChanged = !Object.is(params.reconfigureKey, prevReconfigureKeyRef.current);
    if ((clipChanged || reconfigureChanged) && action && selectedClip) {
      params.configureAction(action, selectedClip);
    }
    prevReconfigureKeyRef.current = params.reconfigureKey;

    const step = stepPlayback({
      prevState: prevStateRef.current,
      state: playState,
      prevTime: prevTimeRef.current,
      transportTime,
      liveTime: action?.time ?? null,
      clipChanged,
    });

    if (step.flushTime && action !== null) {
      params.reportTime(action.time, { immediate: true });
    }

    switch (step.command) {
      case 'ensure-playing': {
        if (action && !action.isRunning()) {
          startAction(action);
        }
        mixer.update(delta * speedScale);
        if (action) params.reportTime(action.time);
        break;
      }
      case 'seek': {
        if (action) {
          seekAction(action, transportTime);
          mixer.update(0);
        }
        break;
      }
      case 'hold-paused': {
        if (action) {
          action.paused = true;
        }
        break;
      }
      case 'stop-and-restore': {
        mixer.stopAllAction();
        params.restore();
        break;
      }
      case 'none': {
        break;
      }
    }

    prevStateRef.current = playState;
    prevTimeRef.current = transportTime;
  });
}
