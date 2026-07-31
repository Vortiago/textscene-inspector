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
// character_body_2d.cpp:742/748 and character_body_3d.cpp:927/933 hint both
// angles "0,180,0.1,radians_as_degrees" with no `or_greater`, so the editor's
// hard stop is 180 degrees: PI radians, not the half-turn this once used. The
// setters are bare assignments, so nothing narrows it further.
const PI_PLUS_EPSILON = Math.PI + 0.0001;

validatorRegistry.registerAll('CharacterBody2D', {
  motion_mode: v.enumInt('motion_mode', 0, 1, MOTION_MODE),
  up_direction: v.vector2('up_direction'),
  velocity: v.vector2('velocity'),
  floor_stop_on_slope: v.boolean('floor_stop_on_slope'),
  floor_constant_speed: v.boolean('floor_constant_speed'),
  floor_block_on_wall: v.boolean('floor_block_on_wall'),
  floor_max_angle: v.float('floor_max_angle', {
    min: 0,
    max: PI_PLUS_EPSILON,
    message: `Property 'floor_max_angle' must be between 0 and ${Math.PI.toFixed(4)} radians (0-180 degrees)`,
  }),
  floor_snap_length: v.float('floor_snap_length', {
    min: 0,
    message: "Property 'floor_snap_length' must be >= 0",
  }),
  wall_min_slide_angle: v.float('wall_min_slide_angle', {
    min: 0,
    max: PI_PLUS_EPSILON,
    message: `Property 'wall_min_slide_angle' must be between 0 and ${Math.PI.toFixed(4)} radians (0-180 degrees)`,
  }),
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
