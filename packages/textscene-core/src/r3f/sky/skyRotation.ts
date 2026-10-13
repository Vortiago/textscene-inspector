/**
 * `sky_rotation` as three reads it, and as the fog reads it: Godot samples the sky through the
 * inverse of the rotation's basis (`storage_rd/render_scene_data_rd.cpp:202-205`).
 */

import * as THREE from 'three';
import type { Vector3 } from '../../parser/vectors.js';

/**
 * `sky_rotation` as three's Euler. `Basis::from_euler` composes Y, X then Z (`core/math/basis.cpp:678`),
 * as three's `YXZ` order does, and three samples a background or an environment through the
 * inverse of the Euler's rotation, as Godot samples its sky.
 */
export function skyEuler(rotation: Vector3): THREE.Euler {
  return new THREE.Euler(rotation.x, rotation.y, rotation.z, 'YXZ');
}

/** World to sky space: the inverse of `sky_rotation`'s basis. */
export function worldToSky(rotation: Vector3): THREE.Matrix3 {
  const basis = new THREE.Matrix4().makeRotationFromEuler(skyEuler(rotation));
  return new THREE.Matrix3().setFromMatrix4(basis).transpose();
}
