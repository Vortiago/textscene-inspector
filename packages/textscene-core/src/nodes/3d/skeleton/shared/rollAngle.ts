/** The roll of a rotation about an axis, which the SkeletonModifier3D family masks and copies by. */

import { normalizedVector3 } from '../../../../godot/math/vector.js';
import type { Quaternion } from '../../../../godot/math/quaternion.js';
import type { Vector3 } from '../../../../godot/math/vector.js';
import { CMP_EPSILON, fposmodp, TAU } from '../../../../godot/math/math.js';

/** `SkeletonModifier3D::symmetrize_angle` (`skeleton_modifier_3d.cpp:341-344`): `angle` in (-pi, pi]. */
function symmetrizedAngle(angle: number): number {
  const wrapped = fposmodp(angle, TAU);
  return wrapped > Math.PI ? wrapped - TAU : wrapped;
}

/**
 * `SkeletonModifier3D::get_roll_angle` (`skeleton_modifier_3d.cpp:346-378`): the angle of the part of
 * `rotation` that turns about `axis`, signed by which way it turns. Zero where nothing turns there.
 *
 * @canonical The roll angle of a rotation about an axis
 */
export function rollAngle(rotation: Quaternion, axis: Vector3): number {
  const [ax, ay, az] = normalizedVector3(axis.x, axis.y, axis.z);
  const dot = rotation.x * ax + rotation.y * ay + rotation.z * az;
  const roll = { x: ax * dot, y: ay * dot, z: az * dot, w: rotation.w };
  const length = Math.hypot(roll.x, roll.y, roll.z, roll.w);
  if (!(length > CMP_EPSILON)) return 0;
  const angle = 2 * Math.acos(Math.min(1, Math.max(-1, roll.w / length)));
  const direction = (roll.x * ax + roll.y * ay + roll.z * az) / length > 0 ? 1 : -1;
  return symmetrizedAngle(angle * direction);
}
