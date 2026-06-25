/**
 * Capture/restore a THREE subtree's local transforms — the "restore the
 * authored (bind) pose on stop/deselect" primitive shared by the full-object
 * animation drivers (GLB animation driver, ADR-0014; AnimationTree driver,
 * ADR-0019). Skeletal/blended clips touch arbitrary bones, so the whole driven
 * subtree is snapshotted rather than a track-derived target set.
 *
 * (The AnimationPlayer slice keeps its own track-derived snapshot — it also
 * restores `rotation` Euler order — so it is intentionally not unified here.)
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
