/**
 * The one way a driver moves the scene through its mixer: it runs the move, then announces the pose
 * to the y-sort and every other pose listener, so no driver branch can skip the announcement.
 */

import { useCallback } from 'react';
import type { AnimationAction } from 'three';
import { useAnnounceMixerPose } from '../contexts/AnimatedValueContext';
import { drivenUuids } from './drivenUuids';

/** Answers `writePose(actions, move)`: `move` updates, seeks or restores what `actions` drive. */
export function useWriteMixerPose(): (
  actions: ReadonlyMap<string, AnimationAction>,
  move: () => void
) => void {
  const announceMixerPose = useAnnounceMixerPose();
  return useCallback(
    (actions, move) => {
      move();
      announceMixerPose(drivenUuids(actions));
    },
    [announceMixerPose]
  );
}
