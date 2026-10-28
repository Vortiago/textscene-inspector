/**
 * The registry of the bone poses an AnimationPlayer writes to a Skeleton3D (ADR-0016, ADR-0017). A
 * pose changes each frame, so it reaches the meshes bound to the skeleton through a listener that
 * updates their skin in place, never through React state that would render the scene again. The
 * registry keeps the last pose, so a mesh that mounts or rebinds mid-playback starts on it.
 */

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { AnimatedPose } from '../../nodes/3d/skeleton3d/skeletonPose';

type PoseListener = (pose: AnimatedPose | null) => void;

export interface AnimatedBonePoseRegistry {
  /** The driver writes the poses of its clip to the Skeleton3D at `skeletonPath`, or `null` to release it. */
  set(skeletonPath: string, pose: AnimatedPose | null): void;
  /** The poses written to the skeleton now, or `null` while its clip writes none. */
  get(skeletonPath: string): AnimatedPose | null;
  /** Calls `listener` on every write to the skeleton, and answers the function that stops it. */
  subscribe(skeletonPath: string, listener: PoseListener): () => void;
}

const NOOP: AnimatedBonePoseRegistry = {
  set: () => {},
  get: () => null,
  subscribe: () => () => {},
};

const AnimatedBonePosesContext = createContext<AnimatedBonePoseRegistry>(NOOP);

export function useAnimatedBonePoses(): AnimatedBonePoseRegistry {
  return useContext(AnimatedBonePosesContext);
}

export function AnimatedBonePosesProvider({ children }: { children: ReactNode }) {
  /** Written only by `set`: the poses now written, by skeleton path. */
  const poses = useRef(new Map<string, AnimatedPose>()).current;
  const listeners = useRef(new Map<string, Set<PoseListener>>()).current;
  const registry = useMemo<AnimatedBonePoseRegistry>(
    () => ({
      set: (skeletonPath, pose) => {
        if (pose) poses.set(skeletonPath, pose);
        else poses.delete(skeletonPath);
        listeners.get(skeletonPath)?.forEach((listener) => listener(pose));
      },
      get: (skeletonPath) => poses.get(skeletonPath) ?? null,
      subscribe: (skeletonPath, listener) => {
        const listening = listeners.get(skeletonPath) ?? new Set<PoseListener>();
        listening.add(listener);
        listeners.set(skeletonPath, listening);
        return () => listening.delete(listener);
      },
    }),
    [poses, listeners]
  );
  return <AnimatedBonePosesContext.Provider value={registry}>{children}</AnimatedBonePosesContext.Provider>;
}
