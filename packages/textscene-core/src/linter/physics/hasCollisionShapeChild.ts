/** Shared "does this body have a shape provider?" check for the physics linters. */

import type { TscnNode } from '../../parser/types.js';
import { isTypeOpaque } from '../parentType.js';
import { descendsFrom } from '../nodeBaseTypes.js';

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
 * True when a DIRECT child can provide this body's collision shapes.
 *
 * Direct, not any descendant, because that is the only relationship Godot
 * registers. A shape attaches itself on `NOTIFICATION_PARENTED`
 * (`collision_shape_2d.cpp:52-55`, `collision_shape_3d.cpp:82-83`, and the two
 * polygon classes alike):
 *
 *     collision_object = Object::cast_to<CollisionObject2D>(get_parent());
 *     if (collision_object) { owner_id = collision_object->create_shape_owner(this); }
 *
 * `get_parent()`, so one level and no further, and `create_shape_owner` is what
 * fills the `shapes` map that `collision_object_2d.cpp:587`'s
 * `if (shapes.is_empty())` tests. A subtree walk therefore reads a shape as
 * belonging to a body it never reached: `StaticBody2D > Node2D > CollisionShape2D`
 * leaves the body shapeless and warned about by Godot, and
 * `Area2D > StaticBody2D > CollisionShape2D` gives the shape to the inner body
 * while the outer one keeps none. Both went unreported.
 *
 * Reads `collisionShapeTypes`, the set `collisionShapeTypesPhrase` names, so the
 * warning text can never offer a type this check ignores.
 *
 * A child `isTypeUnknowable` covers counts, because its class is not in this
 * file: an `instance=` heading names a PackedScene and a heading with neither
 * `type=` nor `instance=` overrides a node declared elsewhere, so a sub-scene
 * rooted at a CollisionShape reads as neither of the two names. Narrowing to
 * direct children is what makes that shape common, and a missed warning beats
 * warning about a body Godot gives a shape. Same predicate `resolveNodePath`
 * declines on, so the two helpers answer this one question the same way.
 */
export function hasCollisionShapeChild(node: TscnNode, dim: '2D' | '3D'): boolean {
  const providers = collisionShapeTypes(dim);
  // `isTypeOpaque`, not `isTypeUnknowable` alone: a GDExtension shape provider
  // is in no catalog here, and reading it as a confident non-match warned about
  // a scene Godot gives a shape. `descendsFrom` rather than an exact name,
  // because the shape owner is created from `CollisionShape2D::_notification`,
  // which a subclass inherits.
  return node.children.some(
    (child) => isTypeOpaque(child) || providers.some((type) => descendsFrom(child.type, type))
  );
}

/** `CollisionShape2D or CollisionPolygon2D`, for a diagnostic message. */
export function collisionShapeTypesPhrase(dim: '2D' | '3D'): string {
  return collisionShapeTypes(dim).join(' or ');
}
