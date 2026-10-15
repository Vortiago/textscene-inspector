/**
 * Collision objects and the bodies derived from them.
 *
 * `CollisionObject2D`/`CollisionObject3D` each declare one "needs a collision
 * shape" `push_back`, implemented as one rule per dimension that reaches every
 * subclass through `descendsFrom`.
 */
import type { WarningRow } from './types.js';

export const physicsBodyWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  CollisionObject2D: [
    {
      at: 'collision_object_2d.cpp:588',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'collisionobject2d-needs-collision-shape' },
    },
  ],

  CollisionObject3D: [
    {
      at: 'collision_object_3d.cpp:739',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'collisionobject3d-needs-collision-shape' },
    },
    {
      at: 'collision_object_3d.cpp:744',
      says: 'non-uniform scale will probably not function as expected',
      verdict: { rule: 'collisionobject3d-non-uniform-scale' },
    },
  ],

  PhysicsBody2D: [
    {
      at: 'physics_body_2d.cpp:177',
      says: 'will not work correctly on a non-interpolated branch of the SceneTree',
      verdict: {
        declined: 'runtime-only',
        because: 'SceneTree::is_fti_enabled_in_project(), a project setting, physics_body_2d.cpp:176',
      },
    },
  ],

  PhysicsBody3D: [
    {
      at: 'physics_body_3d.cpp:218',
      says: 'will not work correctly on a non-interpolated branch of the SceneTree',
      verdict: {
        declined: 'runtime-only',
        because: 'SceneTree::is_fti_enabled_in_project(), a project setting, physics_body_3d.cpp:217',
      },
    },
  ],

  RigidBody2D: [
    {
      at: 'rigid_body_2d.cpp:648',
      says: 'size changes are overridden by the physics engine at runtime',
      verdict: { rule: 'rigidbody2d-scale-overridden-at-runtime' },
    },
  ],

  RigidBody3D: [
    {
      at: 'rigid_body_3d.cpp:667',
      says: 'scale changes are overridden by the physics engine at runtime',
      verdict: { rule: 'rigidbody3d-scale-overridden-at-runtime' },
    },
  ],

  SoftBody3D: [
    {
      at: 'soft_body_3d.cpp:405',
      says: 'this body is ignored until a mesh is set',
      verdict: { rule: 'valid-softbody3d-mesh' },
    },
  ],

  VehicleWheel3D: [
    {
      at: 'vehicle_body_3d.cpp:148',
      says: 'serves to provide a wheel system to a VehicleBody3D; use it as a child of one',
      verdict: { rule: 'vehiclewheel3d-not-under-vehicle-body' },
    },
  ],
};
