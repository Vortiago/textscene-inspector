/**
 * What a Godot cast node's `target_position` draws: the origin→target line its debug vertices
 * hold, and the zero vector no gizmo draws, which both nodes' vertex builders return early on
 * (`ray_cast_3d.cpp:407-412`, `shape_cast_3d.cpp:515-520`).
 */

import type { Vector3 } from '../../../godot/math/vector.js';

/**
 * Whether the target is `Vector3()`, the exact zero `==` compares (three equal components, where a
 * `-0` counts as a zero).
 *
 * @canonical A cast node's zero target
 */
export function isZeroTarget({ x, y, z }: Vector3): boolean {
  return x === 0 && y === 0 && z === 0;
}

/**
 * The origin→target_position line vertices RayCast3D and ShapeCast3D gizmos share, or null at the
 * zero target.
 *
 * @canonical A cast node's origin→target debug line
 */
export function castTargetLine(target: Vector3): Float32Array | null {
  return isZeroTarget(target) ? null : new Float32Array([0, 0, 0, target.x, target.y, target.z]);
}
