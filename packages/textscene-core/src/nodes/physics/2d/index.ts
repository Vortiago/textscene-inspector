/**
 * 2D physics bodies + CollisionShape2D — parser registration.
 *
 * For RENDERING these are all Node2D subclasses (CollisionObject2D → Node2D):
 * only the 2D transform matters, so they reuse `parseNode2D`. Physics-only
 * properties (layers/masks/shape) don't affect the preview and are left
 * unparsed. CollisionShape2D renders no geometry in V1 (a 2D collision gizmo,
 * toggleable like the 3D one, is a later addition). A shared registration is
 * used deliberately — five identical transform-only slices would be rote
 * boilerplate; split into per-type slices if any needs distinct behaviour.
 */

import { nodeRegistry } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

export const TWO_D_PHYSICS_TYPES = [
  'Area2D',
  'StaticBody2D',
  'RigidBody2D',
  'CharacterBody2D',
  'CollisionShape2D',
] as const;

for (const typeName of TWO_D_PHYSICS_TYPES) {
  nodeRegistry.register({
    typeName,
    parser: parseNode2D,
  });
}
