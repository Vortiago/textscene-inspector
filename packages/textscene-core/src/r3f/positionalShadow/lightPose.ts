/**
 * An omni or spot light's pose in the world: its position and rotation. A light's scale counts for
 * nothing in Godot's shadow (`renderer_scene_cull.cpp:2358-2359`), so the pose drops it. The shadow
 * pass reads it on every render, so it writes into the caller's objects.
 */

import * as THREE from 'three';

const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

/** Written only by `readLightPose`, and never read: the scale it receives is the one Godot drops. */
const droppedScale = new THREE.Vector3();

/** Written only by `lightPoseMatrix`, and valid only inside that call. */
const scratchPosition = new THREE.Vector3();
const scratchRotation = new THREE.Quaternion();

/** Writes the light's world position into `position` and its world rotation into `rotation`. */
export function readLightPose(
  light: THREE.Object3D,
  position: THREE.Vector3,
  rotation: THREE.Quaternion
): void {
  light.matrixWorld.decompose(position, rotation, droppedScale);
}

/** Writes the light's pose into `target` as a light-to-world matrix, and returns `target`. */
export function lightPoseMatrix(light: THREE.Object3D, target: THREE.Matrix4): THREE.Matrix4 {
  readLightPose(light, scratchPosition, scratchRotation);
  return target.compose(scratchPosition, scratchRotation, UNIT_SCALE);
}
