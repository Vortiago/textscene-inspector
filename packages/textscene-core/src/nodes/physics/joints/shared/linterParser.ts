/**
 * Validators shared by every joint, 2D and 3D.
 *
 * Registered under the abstract keys `'Joint2D'` and `'Joint3D'`, the shape
 * `physics/shared` uses for `CollisionObject2D`/`CollisionObject3D` and
 * `canvasitem/shared` for `CanvasItem`. Neither is instantiable, so neither
 * appears in a `.tscn` and neither owns a slice; they exist because
 * `NODE_BASE_TYPES` carries every hop of Godot's ancestry, so a validator on an
 * intermediate reaches its subclasses.
 *
 * A joint is NOT a CollisionObject — `Joint2D` derives straight from `Node2D`
 * and `Joint3D` from `Node3D` — so this is a separate tier rather than more
 * keys on that one.
 *
 * The two dimensions are deliberately not merged. Godot gives them different
 * surfaces despite the identical setter: 2D has `bias` and spells the exclusion
 * flag `disable_collision`, 3D has `solver_priority` and spells it
 * `exclude_nodes_from_collision`. Registering either name on both dimensions
 * would silently accept a key that dimension cannot carry.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('Joint2D', {
  // scene/2d/physics/joints/joint_2d.cpp:242-243, PROPERTY_HINT_NODE_PATH_VALID_TYPES
  // "PhysicsBody2D" — a type restriction the linter cannot check without the
  // live tree, so the format is all that is validated here.
  node_a: v.nodePath('node_a'),
  node_b: v.nodePath('node_b'),
  // joint_2d.cpp:244, PROPERTY_HINT_RANGE "0,0.9,0.001" with no `or_greater`.
  bias: v.float('bias', { min: 0, max: 0.9 }),
  // joint_2d.cpp:245. 3D spells the same idea `exclude_nodes_from_collision`.
  disable_collision: v.boolean('disable_collision'),
});

validatorRegistry.registerAll('Joint3D', {
  // scene/3d/physics/joints/joint_3d.cpp:228-229, hinted "PhysicsBody3D".
  node_a: v.nodePath('node_a'),
  node_b: v.nodePath('node_b'),
  // joint_3d.cpp:230, PROPERTY_HINT_RANGE "1,8,1" with no `or_greater`.
  solver_priority: v.int('solver_priority', { min: 1, max: 8 }),
  // joint_3d.cpp:232. 2D spells the same idea `disable_collision`.
  exclude_nodes_from_collision: v.boolean('exclude_nodes_from_collision'),
});
