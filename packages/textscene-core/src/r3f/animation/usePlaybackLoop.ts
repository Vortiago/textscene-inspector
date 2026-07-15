/**
 * Shared transport→mixer playback loop for both animation drivers — the
 * AnimationPlayer slice (value tracks built from GodotAnimations, ADR-0011)
 * and the GLB animation driver (ready-made glTF clips on a GLBSceneRoot).
 *
 * The state machine is identical across both: play advances the mixer and
 * reports the playhead; pause samples the seeked time; stop halts and lets the
 * driver restore its authored pose. What differs is parameterised:
 *   - `speedScale`      — AnimationPlayer honours `speed_scale`; GLB uses 1.
 *   - `configureAction` — how a freshly-selected clip's loop is set (Godot
 *                         `loop_mode` vs a GLB's default looping).
 *   - `restore`         — each driver snapshots and restores its own pose
 *                         (value-track targets vs the whole GLB subtree).
 *
 * The per-frame decision (which transport edge fired, whether to flush time,
 * whether this is a fresh play entry) is delegated to the pure `stepPlayback`
 * reducer; this hook is a thin adapter that builds the input, calls it, and
 * actuates the result on the mixer.
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
   * When this value changes (compared with `Object.is`), `configureAction`
   * re-runs on the CURRENTLY selected action even though the clip itself
   * hasn't changed — e.g. flipping a live loop-override preference
   * must take effect immediately, not only on the next clip switch/replay.
   * Omit (stays `undefined`) to keep the original reconfigure-on-clip-switch-
   * only behavior.
   */
  reconfigureKey?: unknown;
  /**
   * Report the live playhead to the transport (for the scrubber). The
   * transport throttles this internally; pass `{ immediate: true }`
   * to force an unthrottled flush — this loop does so once on the
   * playing → paused edge so the paused readout is never left showing a
   * throttle-stale time.
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
    // Reconfigure on a clip switch OR when reconfigureKey itself
    // changes (e.g. the user flips the loop-override preference mid-clip) —
    // without restarting the currently-running action.
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
