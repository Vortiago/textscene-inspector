/**
 * What a Godot cast node's target_position draws: the origin→target line its debug vertices hold,
 * and the zero vector no gizmo draws (ray_cast_3d.cpp:401-406, shape_cast_3d.cpp:509-514).
 */

import type { Vector3 } from '../../../godot/math/vector.js';
import { parseVector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';

/** `_target_position = Vector3(0, -1, 0)` in scene/3d/physics/ray_cast_3d.h:49 and shape_cast_3d.h:48. */
export const DEFAULT_TARGET_POSITION: Vector3 = Object.freeze({ x: 0, y: -1, z: 0 });

/** `enabled = true` in scene/3d/physics/ray_cast_3d.h:40 and shape_cast_3d.h:41. */
export const DEFAULT_ENABLED = true;

/**
 * Reads a cast node's authored `target_position`, warning and leaving it undefined on a literal
 * the vector grammar refuses, so the consumer applies Godot's default.
 *
 * @canonical A cast node's target_position parse
 */
export function parseCastTargetPosition(
  properties: Record<string, string>,
  label: string
): Vector3 | undefined {
  if (!properties.target_position) return undefined;
  try {
    return parseVector3(properties.target_position);
  } catch (error) {
    warn(
      `[${label}] Failed to parse target_position: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

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
