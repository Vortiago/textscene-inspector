/** Shared "does this body have a shape provider?" check for the physics linters. */

import type { TscnNode } from '../../parser/types.js';
import { hasChildOfType } from '../childType.js';

/**
 * The node types that give a `CollisionObject` its shapes: each calls
 * `collision_object->create_shape_owner(this)` (`collision_polygon_2d.cpp:100`,
 * `collision_polygon_3d.cpp` alike). In 4.6.3 `scene/` has exactly these four
 * callers, and they share no base below `Node2D`/`Node3D` to derive the set from.
 */
export function collisionShapeTypes(dim: '2D' | '3D'): readonly string[] {
  return [`CollisionShape${dim}`, `CollisionPolygon${dim}`];
}

/**
 * True when a direct child can provide this body's collision shapes. A shape
 * attaches on `NOTIFICATION_PARENTED` to `cast_to<CollisionObject2D>(get_parent())`
 * (`collision_shape_2d.cpp:52-55`, `collision_shape_3d.cpp:82-83`, polygons alike),
 * which fills the `shapes` map `collision_object_2d.cpp:587` tests, one level only.
 */
export function hasCollisionShapeChild(node: TscnNode, dim: '2D' | '3D'): boolean {
  // The set `collisionShapeTypesPhrase` names, so no warning offers a type this ignores.
  return hasChildOfType(node, collisionShapeTypes(dim));
}

/** `CollisionShape2D or CollisionPolygon2D`, for a diagnostic message. */
export function collisionShapeTypesPhrase(dim: '2D' | '3D'): string {
  return collisionShapeTypes(dim).join(' or ');
}
