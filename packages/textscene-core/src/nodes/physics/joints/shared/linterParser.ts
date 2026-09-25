/**
 * Validators shared by every joint, registered under the abstract keys `'Joint2D'`
 * and `'Joint3D'`: `NODE_BASE_TYPES` walks every hop of Godot's ancestry, so they
 * reach each subclass. A joint derives from Node2D or Node3D, not CollisionObject.
 * The dimensions stay apart, since a shared key list accepts one a dimension lacks.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key only if these ancestors are imported too.
import '../../../base/node3d/linterParser.js';
import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('Joint2D', {
  // scene/2d/physics/joints/joint_2d.cpp:243-244, PROPERTY_HINT_NODE_PATH_VALID_TYPES
  // "PhysicsBody2D": a type the linter cannot check without the live tree, so
  // only the format is validated.
  node_a: v.nodePath('node_a'),
  node_b: v.nodePath('node_b'),
  // joint_2d.cpp:245, PROPERTY_HINT_RANGE "0,0.9,0.001" with no `or_greater`.
  // set_bias (joint_2d.cpp:191-196) is a bare assignment, so out-of-range warns.
  bias: v.float('bias', { min: 0, max: 0.9, hinted: 'joint_2d.cpp:245' }),
  // joint_2d.cpp:246. 3D spells the same idea `exclude_nodes_from_collision`.
  disable_collision: v.boolean('disable_collision'),
});

validatorRegistry.registerAll('Joint3D', {
  // scene/3d/physics/joints/joint_3d.cpp:228-229, hinted "PhysicsBody3D".
  node_a: v.nodePath('node_a'),
  node_b: v.nodePath('node_b'),
  // joint_3d.cpp:230, PROPERTY_HINT_RANGE "1,8,1" with no `or_greater`.
  // set_solver_priority (joint_3d.cpp:158-163) is a bare assignment, so
  // out-of-range warns.
  solver_priority: v.int('solver_priority', { min: 1, max: 8, hinted: 'joint_3d.cpp:230' }),
  // joint_3d.cpp:232. 2D spells the same idea `disable_collision`.
  exclude_nodes_from_collision: v.boolean('exclude_nodes_from_collision'),
});
