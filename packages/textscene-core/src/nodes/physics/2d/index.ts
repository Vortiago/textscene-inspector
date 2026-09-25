/**
 * StaticBody2D, RigidBody2D and CharacterBody2D parser registration. They are Node2D subclasses
 * (CollisionObject2D, then Node2D) and only their 2D transform affects the preview, so they
 * reuse `parseNode2D` and leave physics-only properties unparsed. One shared registration
 * replaces three identical slices. A type that needs its own behaviour gets its own slice.
 */

import { nodeRegistry } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

export const TWO_D_PHYSICS_TYPES = ['StaticBody2D', 'RigidBody2D', 'CharacterBody2D'] as const;

for (const typeName of TWO_D_PHYSICS_TYPES) {
  nodeRegistry.register({
    typeName,
    parser: parseNode2D,
  });
}
