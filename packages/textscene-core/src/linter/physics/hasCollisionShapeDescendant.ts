/** Shared "does this body have a shape provider?" check for the physics linters. */

import type { TscnNode } from '../../parser/types.js';

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
 *
 * The pair is exhaustive rather than a sample: grepping `create_shape_owner`
 * across `scene/` in 4.6.3 returns these four classes and nothing else, and they
 * share no base below `Node2D`/`Node3D`, so there is no ancestor or interface to
 * derive the set from — Godot does not model one.
 */
export function collisionShapeTypes(dim: '2D' | '3D'): readonly string[] {
  return [`CollisionShape${dim}`, `CollisionPolygon${dim}`];
}

/**
 * True when any descendant can provide this body's collision shapes.
 *
 * ONE walk testing both types per node, not one walk per type. The `.some` form
 * this replaced descended the whole subtree twice whenever the first type was
 * absent — and the miss case is precisely the one that matters, since a body with
 * no shape at all is the warning this backs.
 */
export function hasCollisionShapeDescendant(node: TscnNode, dim: '2D' | '3D'): boolean {
  const shape = `CollisionShape${dim}`;
  const polygon = `CollisionPolygon${dim}`;
  for (const child of node.children) {
    if (child.type === shape || child.type === polygon) return true;
    if (hasCollisionShapeDescendant(child, dim)) return true;
  }
  return false;
}

/** `CollisionShape2D or CollisionPolygon2D`, for a diagnostic message. */
export function collisionShapeTypesPhrase(dim: '2D' | '3D'): string {
  return collisionShapeTypes(dim).join(' or ');
}
