/**
 * The pose of each drawn Skeleton2D of a preview, by the live path of the skeleton. The Skeleton2D
 * component owns the entry of its node, and a Polygon2D or a Bone2D reads it by that path.
 */

import type * as THREE from 'three';
import { perObject } from '../../../utils/perObject.js';
import type { Skeleton2DPose } from './skeletonPose.js';

/** One table for each node-object registry, which is one preview. Written only by {@link mountSkeleton2DPose}. */
const posesOf = perObject(
  (_registry: ReadonlyMap<string, THREE.Object3D>) => new Map<string, Skeleton2DPose>()
);

/** Puts `pose` at `skeletonPath` until the returned disposer runs. */
export function mountSkeleton2DPose(
  registry: ReadonlyMap<string, THREE.Object3D>,
  skeletonPath: string,
  pose: Skeleton2DPose
): () => void {
  const poses = posesOf(registry);
  poses.set(skeletonPath, pose);
  return () => {
    if (poses.get(skeletonPath) === pose) poses.delete(skeletonPath);
  };
}

/** The pose of the Skeleton2D at `skeletonPath`, or undefined while the skeleton is not mounted. */
export function skeleton2DPoseAt(
  registry: ReadonlyMap<string, THREE.Object3D>,
  skeletonPath: string
): Skeleton2DPose | undefined {
  return posesOf(registry).get(skeletonPath);
}
