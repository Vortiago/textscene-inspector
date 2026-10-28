/**
 * Writes the poses of a clip's bone tracks to the Skeleton3D nodes each frame. The playhead is the one
 * of the mixer, so the pose and the transform tracks agree. The meshes bound to a skeleton take the
 * poses through the registry and move their skin in place, so no frame renders the scene again.
 */

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { AnimationAction } from 'three';
import { useAnimatedBonePoses } from '../../../r3f/contexts/AnimatedBonePosesContext';
import { sampleBonePoses, type BoneTrack } from './boneTracks';

/** The bone tracks of the clip that plays, and the name its mixer action goes by. */
export interface BoneClip {
  name: string;
  tracks: readonly BoneTrack[];
}

/**
 * Writes the poses of `clip` while `isPlaying`, and releases every skeleton once the clip stops, is
 * switched away or has no bone track (`clip` null), so the file pose returns.
 */
export function useBonePoses(
  clip: BoneClip | null,
  isPlaying: boolean,
  actionsRef: MutableRefObject<Map<string, AnimationAction>>
): void {
  const registry = useAnimatedBonePoses();
  /** Written only by the frame and `release`: the skeletons this clip writes to now. */
  const written = useRef<ReadonlySet<string>>(new Set());
  /** Written only by the frame and `release`: the playhead the poses were sampled at. */
  const sampledAt = useRef<number | null>(null);

  const release = useCallback(() => {
    written.current.forEach((skeletonPath) => registry.set(skeletonPath, null));
    written.current = new Set();
    sampledAt.current = null;
  }, [registry]);

  useFrame(() => {
    const action = clip ? actionsRef.current.get(clip.name) : undefined;
    if (!clip || !isPlaying || !action) {
      release();
      return;
    }
    // The live playhead, which the playback loop advanced earlier this frame. A paused clip stands
    // on the poses it wrote.
    if (action.time === sampledAt.current) return;
    sampledAt.current = action.time;
    const poses = sampleBonePoses(clip.tracks, action.time);
    poses.forEach((pose, skeletonPath) => registry.set(skeletonPath, pose));
    written.current.forEach((skeletonPath) => {
      if (!poses.has(skeletonPath)) registry.set(skeletonPath, null);
    });
    written.current = new Set(poses.keys());
  });

  // A stop, a deselect or a switch of clip releases at once, not on the next frame, as the value tracks do.
  useEffect(() => {
    if (!clip || !isPlaying) release();
  }, [clip, isPlaying, release]);
  // A new clip is sampled again, though its playhead has not moved.
  useEffect(() => {
    sampledAt.current = null;
  }, [clip]);
  useEffect(() => release, [release]);
}
