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
 */
import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { AnimationAction, AnimationMixer } from 'three';
import type { PlayState } from '../contexts/AnimationTransportContext';

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
   * hasn't changed — e.g. flipping a live loop-override preference (#224)
   * must take effect immediately, not only on the next clip switch/replay.
   * Omit (stays `undefined`) to keep the original reconfigure-on-clip-switch-
   * only behavior.
   */
  reconfigureKey?: unknown;
  /**
   * Report the live playhead to the transport (for the scrubber). The
   * transport throttles this internally (WI-213); pass `{ immediate: true }`
   * to force an unthrottled flush — this loop does so once on the
   * playing → paused edge (`flushTimeOnPauseEdge`) so the paused readout is
   * never left showing a throttle-stale time.
   */
  reportTime: (t: number, options?: { immediate?: boolean }) => void;
  /** Restore the authored pose when playback stops. */
  restore: () => void;
}

/**
 * WI-213 edge-flush, shared by every transport driver's frame loop
 * (`usePlaybackLoop`, AnimationTree's weighted loop, AnimatedSprite2D's
 * frame stepper): `reportTime()` is throttled by the transport, so the LAST
 * report before playback leaves 'playing' can be up to the throttle window
 * stale — and the paused state doesn't report again on its own. Call this
 * once per frame BEFORE acting on `state`; on the playing → PAUSED edge it
 * flushes the driver's exact current time unthrottled so the paused readout
 * is never left stale. `getTime` returning `null` means the driver has no
 * live playhead to flush (e.g. no action selected).
 *
 * Deliberately does NOT fire on the playing → stopped edge: every stopped
 * transition (transport `stop()`, deselection's `registerPlayer` cleanup)
 * already resets the transport time to 0, and flushing the pre-stop
 * playhead here would overwrite that reset — leaving the scrubber/timecode
 * stuck at the old time while the pose shows the authored rest state.
 */
export function flushTimeOnPauseEdge(
  prevState: PlayState,
  state: PlayState,
  getTime: () => number | null,
  reportTime: (t: number, options?: { immediate?: boolean }) => void
): void {
  if (prevState !== 'playing' || state !== 'paused') return;
  const time = getTime();
  if (time !== null) reportTime(time, { immediate: true });
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
    // #224: reconfigure on a clip switch OR when reconfigureKey itself
    // changes (e.g. the user flips the loop-override preference mid-clip) —
    // without restarting the currently-running action.
    const reconfigureChanged = !Object.is(params.reconfigureKey, prevReconfigureKeyRef.current);
    if ((clipChanged || reconfigureChanged) && action && selectedClip) {
      params.configureAction(action, selectedClip);
    }
    prevReconfigureKeyRef.current = params.reconfigureKey;

    flushTimeOnPauseEdge(prevStateRef.current, playState, () => action?.time ?? null, params.reportTime);

    switch (playState) {
      case 'playing': {
        if (action && !action.isRunning()) {
          action.paused = false;
          action.enabled = true;
          action.play();
        }
        mixer.update(delta * speedScale);
        if (action) params.reportTime(action.time);
        break;
      }
      case 'paused': {
        if (action) {
          // Apply an external seek by sampling the clip at the transport time.
          if (transportTime !== prevTimeRef.current) {
            action.enabled = true;
            action.play();
            action.paused = true;
            action.time = transportTime;
            mixer.update(0);
          } else {
            action.paused = true;
          }
        }
        break;
      }
      case 'stopped': {
        if (prevStateRef.current !== 'stopped') {
          mixer.stopAllAction();
          params.restore();
        }
        break;
      }
    }

    prevStateRef.current = playState;
    prevTimeRef.current = transportTime;
  });
}
