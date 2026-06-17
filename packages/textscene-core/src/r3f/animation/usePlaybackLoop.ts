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
  /** Report the live playhead to the transport (for the scrubber). */
  reportTime: (t: number) => void;
  /** Restore the authored pose when playback stops. */
  restore: () => void;
}

export function usePlaybackLoop(params: PlaybackLoopParams): void {
  const prevStateRef = useRef<PlayState>('stopped');
  const prevClipRef = useRef<string | null>(null);
  const prevTimeRef = useRef<number>(0);

  useFrame((_, delta) => {
    const { playState, selectedClip, transportTime, mixerRef, actionsRef } = params;
    const speedScale = params.speedScale ?? 1;
    const mixer = mixerRef.current;
    if (!mixer) return;
    const action = selectedClip ? actionsRef.current.get(selectedClip) ?? null : null;

    // Clip switch: stop the previous action so only one drives at a time.
    if (selectedClip !== prevClipRef.current) {
      const prev = prevClipRef.current ? actionsRef.current.get(prevClipRef.current) : null;
      prev?.stop();
      prevClipRef.current = selectedClip;
      if (action && selectedClip) params.configureAction(action, selectedClip);
    }

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
