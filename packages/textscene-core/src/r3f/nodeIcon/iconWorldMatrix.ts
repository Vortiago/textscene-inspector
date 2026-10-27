/**
 * The world matrix of a node icon. Godot draws it as a billboard quad of ±0.05 with
 * `FLAG_FIXED_SIZE` and no `FLAG_BILLBOARD_KEEP_SCALE` (`node_3d_editor_gizmos.cpp:331-386,949-985`),
 * so the quad keeps the origin of its node, faces the camera and drops the node's scale, and the
 * fixed-size factor then scales it.
 */

import * as THREE from 'three';
import { fixedSizeFactor } from '../fixedSizeFactor';

/** Scratch, overwritten by every call: this runs on every rendered frame. */
const scale = new THREE.Vector3();

/**
 * Writes the matrix into `target` and returns it. `camera.matrixWorld` and
 * `camera.matrixWorldInverse` must be current.
 */
export function iconWorldMatrix(
  target: THREE.Matrix4,
  worldOrigin: THREE.Vector3,
  camera: THREE.Camera
): THREE.Matrix4 {
  const factor = fixedSizeFactor(camera, worldOrigin);
  return target.extractRotation(camera.matrixWorld).scale(scale.setScalar(factor)).setPosition(worldOrigin);
}
