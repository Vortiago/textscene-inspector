/**
 * Writes what a clip samples to a push store each frame, and releases it when the clip stops. The
 * AnimationPlayer's bone driver and value driver both run on it. The playhead is the one of the
 * mixer, so the pushed values and the transform tracks agree.
 */

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { AnimationAction } from 'three';
import type { PushStore } from '../contexts/pushStore';

/** The clip a driver writes: its action name, and what it samples into `out` at a time, by store key. */
export interface PushedClip<T> {
  name: string;
  sample: (time: number, out: Map<string, T>) => void;
}

/**
 * Pushes `clip` to `store` while `isPlaying`. A stop, a deselect, a switch of clip or an unmount
 * releases every key written, so the authored values return.
 */
export function usePushedWrites<T>(
  store: PushStore<T>,
  clip: PushedClip<T> | null,
  isPlaying: boolean,
  actionsRef: MutableRefObject<Map<string, AnimationAction>>
): void {
  /** Written only by the frame and `release`: the keys this clip writes now. */
  const written = useRef<Set<string>>(new Set());
  /** Written only by the frame and `release`: the sample of this frame, reused so a frame allocates no map. */
  const sampled = useRef<Map<string, T>>(new Map());
  /** Written only by the frame and `release`: the playhead the values were sampled at. */
  const sampledAt = useRef<number | null>(null);

  const release = useCallback(() => {
    // The frame calls this while nothing plays, so an idle player allocates nothing.
    if (written.current.size === 0 && sampledAt.current === null) return;
    written.current.forEach((key) => store.set(key, null));
    written.current.clear();
    sampledAt.current = null;
  }, [store]);

  useFrame(() => {
    const action = clip ? actionsRef.current.get(clip.name) : undefined;
    if (!clip || !isPlaying || !action) {
      release();
      return;
    }
    // The live playhead, which the playback loop advanced earlier this frame. A paused clip stands
    // on the values it wrote.
    if (action.time === sampledAt.current) return;
    sampledAt.current = action.time;
    const now = sampled.current;
    now.clear();
    clip.sample(action.time, now);
    now.forEach((value, key) => store.set(key, value));
    written.current.forEach((key) => {
      if (!now.has(key)) store.set(key, null);
    });
    written.current.clear();
    now.forEach((_, key) => written.current.add(key));
  });

  // A stop, a deselect or a switch of clip releases at once, not on the next frame.
  useEffect(() => {
    if (!clip || !isPlaying) release();
  }, [clip, isPlaying, release]);
  // A new clip is sampled again, though its playhead has not moved.
  useEffect(() => {
    sampledAt.current = null;
  }, [clip]);
  useEffect(() => release, [release]);
}
