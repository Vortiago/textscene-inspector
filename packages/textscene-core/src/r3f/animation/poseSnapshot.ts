/**
 * Captures and restores the local transforms of the objects a driver's clips move, so every driver
 * (AnimationPlayer, GLB per ADR-0014, AnimationTree per ADR-0019) restores the authored pose on stop.
 */

import type { Euler, Object3D, Quaternion, Vector3 } from 'three';

export interface PoseSnapshot {
  object: Object3D;
  position: Vector3;
  rotation: Euler;
  quaternion: Quaternion;
  scale: Vector3;
}

/** Every object in `root`'s subtree: a skeletal or blended glTF clip may touch any bone. */
export function subtreeObjects(root: Object3D): Object3D[] {
  const objects: Object3D[] = [];
  root.traverse((object) => objects.push(object));
  return objects;
}

/**
 * Snapshot each object's local transform. The Euler rotation too: it carries the order an
 * AnimationPlayer reorders its targets to, which the quaternion does not.
 */
export function snapshotPose(objects: readonly Object3D[]): PoseSnapshot[] {
  return objects.map((object) => ({
    object,
    position: object.position.clone(),
    rotation: object.rotation.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
  }));
}

export function restoreSnapshot(snapshots: readonly PoseSnapshot[]): void {
  for (const snap of snapshots) {
    snap.object.position.copy(snap.position);
    snap.object.rotation.copy(snap.rotation);
    snap.object.quaternion.copy(snap.quaternion);
    snap.object.scale.copy(snap.scale);
  }
}
