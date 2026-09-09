/**
 * Validators shared by every PhysicsBody3D-derived node: the six axis locks.
 *
 * Registered under the abstract key 'PhysicsBody3D', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice; it reaches the six
 * 3D bodies through the NODE_BASE_TYPES base-walk. Each direct heir's
 * linterParser imports this module, which imports the CollisionObject3D tier
 * above it. PhysicsBody2D binds nothing and has no twin here.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// physics_body_3d.cpp:46-51: six BOOL ADD_PROPERTYI over one `locked_axis`
// bitfield, serialised as six independent bools. set_axis_lock:189-196 sets or
// clears the bit and refuses nothing.
validatorRegistry.registerAll('PhysicsBody3D', {
  axis_lock_linear_x: v.boolean('axis_lock_linear_x'),
  axis_lock_linear_y: v.boolean('axis_lock_linear_y'),
  axis_lock_linear_z: v.boolean('axis_lock_linear_z'),
  axis_lock_angular_x: v.boolean('axis_lock_angular_x'),
  axis_lock_angular_y: v.boolean('axis_lock_angular_y'),
  axis_lock_angular_z: v.boolean('axis_lock_angular_z'),
});
