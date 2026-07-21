/**
 * Godot's 3D editor viewport camera.
 *
 * `Node3DEditorViewport::Cursor()` opens every scene the same way, whatever is
 * in it:
 *
 *   // These rotations place the camera in +X +Y +Z, aka south east, facing north west.
 *   x_rot = 0.5;  y_rot = -0.5;  distance = 4;
 *
 * and `to_camera_transform` builds the basis by rotating about X then Y (both
 * negated) and stepping `distance` along the result's local +Z. There is no
 * framing step: a scene the size of a city block opens at distance 4 from the
 * origin, and the user presses F.
 */

import * as THREE from 'three';

/** `cursor.x_rot` / `cursor.y_rot`, in radians. */
export const EDITOR_CAMERA_X_ROT = 0.5;
export const EDITOR_CAMERA_Y_ROT = -0.5;

/** `cursor.distance`. */
export const EDITOR_CAMERA_DISTANCE = 4;

/** `editors/3d/default_fov`, in degrees. three's own default is 50. */
export const EDITOR_CAMERA_FOV = 70;

/**
 * The unit vector from the orbit target towards the camera — the direction a
 * scene is viewed FROM. Derived rather than hard-coded so the two rotations
 * above stay the single source of truth.
 */
export function editorCameraDirection(): THREE.Vector3 {
  return new THREE.Vector3(0, 0, 1)
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), -EDITOR_CAMERA_X_ROT)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), -EDITOR_CAMERA_Y_ROT)
    .normalize();
}

/** Where the camera sits when a scene is first opened, orbiting the origin. */
export function editorCameraPosition(): [number, number, number] {
  const { x, y, z } = editorCameraDirection().multiplyScalar(EDITOR_CAMERA_DISTANCE);
  return [x, y, z];
}
