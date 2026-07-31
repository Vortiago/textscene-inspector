/**
 * CharacterBody3D strict validators for linting.
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
validatorRegistry.registerAll('CharacterBody3D', {
  motion_mode: v.enumInt('motion_mode', 0, 1, MOTION_MODE),
  up_direction: v.vector3('up_direction'),
  velocity: v.vector3('velocity'),
  floor_stop_on_slope: v.boolean('floor_stop_on_slope'),
  floor_constant_speed: v.boolean('floor_constant_speed'),
  floor_block_on_wall: v.boolean('floor_block_on_wall'),
  // character_body_3d.cpp:927/933, PROPERTY_HINT_RANGE "0,180,0.1,radians_as_degrees", no or_greater;
  // the setters are bare assignments, so PI is the hard bound.
  floor_max_angle: v.radians('floor_max_angle', { maxDeg: 180 }),
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
  safe_margin: v.float('safe_margin', {
    min: 0,
    message: "Property 'safe_margin' must be >= 0",
  }),
  max_slides: v.positiveInt(
    'max_slides',
    "Property 'max_slides' must be greater than 0. Character needs at least 1 slide iteration to function."
  ),
});
