/**
 * CharacterBody2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const MOTION_MODE = { 0: 'GROUNDED', 1: 'FLOATING' };
const PLATFORM_ON_LEAVE = {
  0: 'ADD_VELOCITY',
  1: 'ADD_UPWARD_VELOCITY',
  2: 'DO_NOTHING',
};
validatorRegistry.registerAll('CharacterBody2D', {
  motion_mode: v.enumInt('motion_mode', 0, 1, MOTION_MODE),
  up_direction: v.vector2('up_direction'),
  velocity: v.vector2('velocity'),
  floor_stop_on_slope: v.boolean('floor_stop_on_slope'),
  floor_constant_speed: v.boolean('floor_constant_speed'),
  floor_block_on_wall: v.boolean('floor_block_on_wall'),
  // character_body_2d.cpp:742/748, PROPERTY_HINT_RANGE "0,180,0.1,radians_as_degrees", no or_greater;
  // the setters are bare assignments, so PI is the hard bound.
  floor_max_angle: v.radians('floor_max_angle', { maxDeg: 180 }),
  // character_body_2d.cpp:631, ERR_FAIL_COND(p_floor_snap_length < 0): the setter refuses.
  floor_snap_length: v.float('floor_snap_length', {
    min: 0,
    message: "Property 'floor_snap_length' must be >= 0",
  }),
  wall_min_slide_angle: v.radians('wall_min_slide_angle', { maxDeg: 180 }),
  platform_on_leave: v.enumInt('platform_on_leave', 0, 2, PLATFORM_ON_LEAVE),
  platform_floor_layers: v.int('platform_floor_layers', {
    min: 0,
    max: 4294967295,
    message:
      "Property 'platform_floor_layers' must be between 0 and 4294967295. Valid range: 32-bit bitmask",
  }),
  platform_wall_layers: v.int('platform_wall_layers', {
    min: 0,
    max: 4294967295,
    message:
      "Property 'platform_wall_layers' must be between 0 and 4294967295. Valid range: 32-bit bitmask",
  }),
  // character_body_2d.cpp:537 is a bare assignment, so the hint at
  // :757 ("0.001,256,0.001") is advisory: out-of-range is a warning, not an error.
  safe_margin: v.float('safe_margin'),
  // character_body_2d.cpp:613, ERR_FAIL_COND(p_max_slides < 1): the setter refuses.
  max_slides: v.positiveInt(
    'max_slides',
    "Property 'max_slides' must be greater than 0. Character needs at least 1 slide iteration to function."
  ),
});
