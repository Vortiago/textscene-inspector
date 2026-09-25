/**
 * Captures and restores a THREE subtree's local transforms, so the GLB (ADR-0014)
 * and AnimationTree (ADR-0019) drivers restore the authored pose on stop. A
 * blended clip touches any bone, so the whole subtree is kept. AnimationPlayer
 * keeps its own track snapshot, which restores the Euler order too.
 */

import type { Object3D, Quaternion, Vector3 } from 'three';

export interface PoseSnapshot {
  object: Object3D;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

/** Snapshot every descendant's local position/quaternion/scale. */
export function snapshotSubtree(root: Object3D): PoseSnapshot[] {
  const snapshots: PoseSnapshot[] = [];
  root.traverse((object) => {
    snapshots.push({
      object,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone(),
    });
  });
  return snapshots;
}

export function restoreSnapshot(snapshots: readonly PoseSnapshot[]): void {
  for (const snap of snapshots) {
    snap.object.position.copy(snap.position);
    snap.object.quaternion.copy(snap.quaternion);
    snap.object.scale.copy(snap.scale);
  }
}
