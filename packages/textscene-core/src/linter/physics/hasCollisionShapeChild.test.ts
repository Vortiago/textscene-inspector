/**
 * A CollisionPolygon provides a body's shapes exactly as a CollisionShape does.
 *
 * The four body rules used to check the `CollisionShape<dim>` type literal
 * alone, which is a FALSE POSITIVE on scenes Godot itself ships:
 * `scenes/demos/2d/physics_platformer/tileset_edit.tscn` has a StaticBody2D
 * whose only child is a CollisionPolygon2D, and it was warned about. It stayed
 * invisible because `fixtureLint` sweeps `scenes/fixtures/` and not
 * `scenes/demos/`.
 */

import { describe, expect, it } from 'vitest';
import { hasCollisionShapeChild, collisionShapeTypesPhrase } from './hasCollisionShapeChild.js';
import type { TscnNode } from '../../parser/types.js';

/** The smallest node shape these rules walk. */
function node(type: string, children: TscnNode[] = []): TscnNode {
  return { type, name: type, properties: {}, children } as unknown as TscnNode;
}

describe('hasCollisionShapeChild', () => {
  it.each(['2D', '3D'] as const)('accepts a CollisionShape%s child', (dim) => {
    expect(hasCollisionShapeChild(node('Body', [node(`CollisionShape${dim}`)]), dim)).toBe(true);
  });

  it.each(['2D', '3D'] as const)('accepts a CollisionPolygon%s child', (dim) => {
    // `CollisionPolygon2D::_notification` calls
    // `collision_object->create_shape_owner(this)` (collision_polygon_2d.cpp:100),
    // the identical mechanism CollisionShape2D uses; the 3D class does the same.
    expect(hasCollisionShapeChild(node('Body', [node(`CollisionPolygon${dim}`)]), dim)).toBe(
      true
    );
  });

  // An `instance=` heading names a PackedScene, so the parser leaves the
  // `ExtResource("…")` literal in `type` and a sub-scene rooted at a shape reads
  // as neither name. Declining is the same call every NodePath rule makes.
  it.each(['2D', '3D'] as const)('counts an instanced child, whose class is elsewhere (%s)', (dim) => {
    const child = { ...node('ExtResource("1_shape")'), instance: 'ExtResource("1_shape")' };
    expect(hasCollisionShapeChild(node('Body', [child]), dim)).toBe(true);
  });

  // `collision_shape_2d.cpp:55` / `collision_shape_3d.cpp:83` attach on
  // `Object::cast_to<CollisionObject2D>(get_parent())`, so an intervening node keeps
  // the shape off this body entirely and Godot's `shapes.is_empty()` warning
  // (`collision_object_2d.cpp:587`) still fires.
  it.each(['2D', '3D'] as const)('does NOT count a shape one level deeper (%s)', (dim) => {
    const tree = node('Body', [node('Pivot', [node(`CollisionPolygon${dim}`)])]);
    expect(hasCollisionShapeChild(tree, dim)).toBe(false);
  });

  // The shape belongs to the inner body; the outer one keeps none of its own.
  it.each(['2D', '3D'] as const)('does NOT count a nested body’s shape (%s)', (dim) => {
    const tree = node('Area', [node(`StaticBody${dim}`, [node(`CollisionShape${dim}`)])]);
    expect(hasCollisionShapeChild(tree, dim)).toBe(false);
  });

  it.each(['2D', '3D'] as const)('still reports a body with no shape provider (%s)', (dim) => {
    expect(hasCollisionShapeChild(node('Body', [node('Sprite2D')]), dim)).toBe(false);
  });

  it('does not accept the other dimension, which owns different shapes', () => {
    expect(hasCollisionShapeChild(node('Body', [node('CollisionPolygon3D')]), '2D')).toBe(false);
  });

  it('names both accepted types in the diagnostic', () => {
    expect(collisionShapeTypesPhrase('2D')).toBe('CollisionShape2D or CollisionPolygon2D');
  });
});
