/**
 * `sky_rotation` as three reads it, and as the fog reads it: Godot samples the sky through the
 * inverse of the rotation's basis (`storage_rd/render_scene_data_rd.cpp:202-205`).
 */

import * as THREE from 'three';
import type { Vector3 } from '../../godot/math/vector.js';

/**
 * `sky_rotation` as three's Euler. `Basis::from_euler` composes Y, X then Z (`core/math/basis.cpp:678`),
 * as three's `YXZ` order does, and three samples a background or an environment through the
 * inverse of the Euler's rotation, as Godot samples its sky.
 */
export function skyEuler(rotation: Vector3): THREE.Euler {
  return new THREE.Euler(rotation.x, rotation.y, rotation.z, 'YXZ');
}

/** Scratch for one conversion, overwritten by each. */
const basis = new THREE.Matrix4();

/** World to sky space, the inverse of the sky's `rotation` basis, written into `target`. */
export function worldToSky(rotation: THREE.Euler, target: THREE.Matrix3): THREE.Matrix3 {
  return target.setFromMatrix4(basis.makeRotationFromEuler(rotation)).transpose();
}
