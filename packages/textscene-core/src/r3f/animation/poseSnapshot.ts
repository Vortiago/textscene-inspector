/**
 * Captures and restores the local transforms of the objects a driver's clips move, so the GLB
 * (ADR-0014) and AnimationTree (ADR-0019) drivers restore the authored pose on stop. AnimationPlayer
 * keeps its own track snapshot, which restores the Euler order too.
 */

import type { Object3D, Quaternion, Vector3 } from 'three';

export interface PoseSnapshot {
  object: Object3D;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

/** Every object in `root`'s subtree: a skeletal or blended glTF clip may touch any bone. */
export function subtreeObjects(root: Object3D): Object3D[] {
  const objects: Object3D[] = [];
  root.traverse((object) => objects.push(object));
  return objects;
}

/** Snapshot each object's local position/quaternion/scale. */
export function snapshotPose(objects: readonly Object3D[]): PoseSnapshot[] {
  return objects.map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
  }));
}

export function restoreSnapshot(snapshots: readonly PoseSnapshot[]): void {
  for (const snap of snapshots) {
    snap.object.position.copy(snap.position);
    snap.object.quaternion.copy(snap.quaternion);
    snap.object.scale.copy(snap.scale);
  }
}
