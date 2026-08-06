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
import { hasCollisionShapeDescendant, collisionShapeTypesPhrase } from './hasCollisionShapeDescendant.js';
import type { TscnNode } from '../../parser/types.js';

/** The smallest node shape these rules walk. */
function node(type: string, children: TscnNode[] = []): TscnNode {
  return { type, name: type, properties: {}, children } as unknown as TscnNode;
}

describe('hasCollisionShapeDescendant', () => {
  it.each(['2D', '3D'] as const)('accepts a CollisionShape%s child', (dim) => {
    expect(hasCollisionShapeDescendant(node('Body', [node(`CollisionShape${dim}`)]), dim)).toBe(true);
  });

  it.each(['2D', '3D'] as const)('accepts a CollisionPolygon%s child', (dim) => {
    // `CollisionPolygon2D::_notification` calls
    // `collision_object->create_shape_owner(this)` (collision_polygon_2d.cpp:100),
    // the identical mechanism CollisionShape2D uses; the 3D class does the same.
    expect(hasCollisionShapeDescendant(node('Body', [node(`CollisionPolygon${dim}`)]), dim)).toBe(
      true
    );
  });

  it.each(['2D', '3D'] as const)('finds a shape provider nested deeper (%s)', (dim) => {
    const tree = node('Body', [node('Pivot', [node(`CollisionPolygon${dim}`)])]);
    expect(hasCollisionShapeDescendant(tree, dim)).toBe(true);
  });

  it.each(['2D', '3D'] as const)('still reports a body with no shape provider (%s)', (dim) => {
    expect(hasCollisionShapeDescendant(node('Body', [node('Sprite2D')]), dim)).toBe(false);
  });

  it('does not accept the other dimension, which owns different shapes', () => {
    expect(hasCollisionShapeDescendant(node('Body', [node('CollisionPolygon3D')]), '2D')).toBe(false);
  });

  it('names both accepted types in the diagnostic', () => {
    expect(collisionShapeTypesPhrase('2D')).toBe('CollisionShape2D or CollisionPolygon2D');
  });
});
