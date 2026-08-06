/** Shared "does this body have a shape provider?" check for the physics linters. */

import type { TscnNode } from '../../parser/types.js';
import { hasDescendantOfType } from './hasDescendantOfType.js';

/**
 * The node types that give a `CollisionObject` its shapes, for one dimension.
 *
 * BOTH count, and checking only `CollisionShape` is a false positive Godot's own
 * demos trip: `CollisionPolygon2D::_notification` calls
 * `collision_object->create_shape_owner(this)` (`collision_polygon_2d.cpp:100`),
 * the identical mechanism `CollisionShape2D` uses, and
 * `collision_polygon_3d.cpp` does the same. A body whose only child is a
 * polygon is fully valid — `scenes/demos/2d/physics_platformer/tileset_edit.tscn`
 * has exactly that shape and was being warned about.
 */
export function collisionShapeTypes(dim: '2D' | '3D'): readonly string[] {
  return [`CollisionShape${dim}`, `CollisionPolygon${dim}`];
}

/** True when any descendant can provide this body's collision shapes. */
export function hasCollisionShapeDescendant(node: TscnNode, dim: '2D' | '3D'): boolean {
  return collisionShapeTypes(dim).some((type) => hasDescendantOfType(node, type));
}

/** `CollisionShape2D or CollisionPolygon2D`, for a diagnostic message. */
export function collisionShapeTypesPhrase(dim: '2D' | '3D'): string {
  return collisionShapeTypes(dim).join(' or ');
}
