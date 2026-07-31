/**
 * Validators shared by every CollisionObject-derived node — the bodies
 * (`StaticBody`, `RigidBody`, `CharacterBody`, and their leaves) and the areas.
 *
 * Registered under the abstract keys `'CollisionObject2D'` and
 * `'CollisionObject3D'`, the shape `3d/lights/shared` uses for `Light3D` and
 * `canvasitem/shared` for `CanvasItem`. Neither is instantiable, so neither
 * appears in a `.tscn` and neither owns a slice; they exist here because
 * `NODE_BASE_TYPES` carries every hop of Godot's ancestry, so a validator
 * registered on an intermediate reaches its subclasses.
 *
 * `PhysicsBody2D`/`PhysicsBody3D` sit between these and the concrete bodies and
 * bind no properties at all, so they get no tier.
 *
 * These keys previously had no owner and were copied into each leaf, which is
 * how they drifted: `collision_layer` and `collision_mask` were declared four
 * times per dimension, and `disable_mode` had four different answers across
 * seven types — bounded 0-1 on CharacterBody2D/RigidBody3D/CharacterBody3D
 * (rejecting the legal `KEEP_ACTIVE`), 0-2 on StaticBody3D and Area2D, and
 * absent on StaticBody2D and Area3D.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

/**
 * scene/2d/physics/collision_object_2d.cpp:652-654 and its 3D twin at :514-516
 * bind the same three constants; :642 hints them "Remove,Make Static,Keep Active".
 */
const DISABLE_MODE = { 0: 'REMOVE', 1: 'MAKE_STATIC', 2: 'KEEP_ACTIVE' };

/** The four keys both dimensions declare identically. */
const shared = () => ({
  disable_mode: v.enumInt('disable_mode', 0, 2, DISABLE_MODE),
  // PROPERTY_HINT_LAYERS_2D_PHYSICS / _3D_PHYSICS — collision_object_2d.cpp:645.
  collision_layer: layerBitmask('collision_layer'),
  collision_mask: layerBitmask('collision_mask'),
  // collision_object_2d.cpp:647 — a plain FLOAT, no range hint, so no bound.
  collision_priority: v.float('collision_priority'),
});

validatorRegistry.registerAll('CollisionObject2D', {
  ...shared(),
  // collision_object_2d.cpp:650. The 3D twin spells it `input_ray_pickable`.
  input_pickable: v.boolean('input_pickable'),
});

validatorRegistry.registerAll('CollisionObject3D', {
  ...shared(),
  // collision_object_3d.cpp:511-512. `input_capture_on_drag` is 3D-only.
  input_ray_pickable: v.boolean('input_ray_pickable'),
  input_capture_on_drag: v.boolean('input_capture_on_drag'),
});
