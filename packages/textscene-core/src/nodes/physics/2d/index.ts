/**
 * Remaining 2D physics bodies — parser registration.
 *
 * StaticBody2D/RigidBody2D/CharacterBody2D are all Node2D subclasses
 * (CollisionObject2D → Node2D): only the 2D transform matters for rendering,
 * so they reuse `parseNode2D` verbatim. Physics-only properties (mass,
 * damping, …) don't affect the preview and are left unparsed. A shared
 * registration is used deliberately — three identical transform-only slices
 * would be rote boilerplate; split into a per-type slice if any needs
 * distinct behaviour.
 *
 * Area2D and CollisionShape2D used to share this loop too, but both grew
 * distinct behaviour (Area2D parses monitoring/layer/mask for the Inspector;
 * CollisionShape2D draws a toggleable shape gizmo) and moved to their own
 * `area2d/` / `collisionshape2d/` slices — mirroring the 3D physics
 * convention (`physics/3d/area3d/`, `physics/3d/collisionshape3d/`).
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
