/**
 * CharacterBody3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

const MOTION_MODE = { 0: 'GROUNDED', 1: 'FLOATING' };
const PLATFORM_ON_LEAVE = {
  0: 'ADD_VELOCITY',
  1: 'ADD_UPWARD_VELOCITY',
  2: 'DO_NOTHING',
};
validatorRegistry.registerAll('CharacterBody3D', {
  // character_body_3d.cpp:922 "Grounded,Floating". set_motion_mode is a bare
  // assignment, so out-of-range warns.
  motion_mode: v.enumInt('motion_mode', 0, 1, MOTION_MODE, {
    hinted: 'character_body_3d.cpp:922',
  }),
  up_direction: v.vector3('up_direction'),
  slide_on_ceiling: v.boolean('slide_on_ceiling'),
  velocity: v.vector3('velocity'),
  floor_stop_on_slope: v.boolean('floor_stop_on_slope'),
  floor_constant_speed: v.boolean('floor_constant_speed'),
  floor_block_on_wall: v.boolean('floor_block_on_wall'),
  // character_body_3d.cpp:933, PROPERTY_HINT_RANGE "0,180,0.1,radians_as_degrees",
  // no or_greater; the setter (:822-824) is a bare assignment, so out-of-range warns.
  floor_max_angle: v.radians('floor_max_angle', {
    minDeg: 0,
    maxDeg: 180,
    hinted: 'character_body_3d.cpp:933',
  }),
  // character_body_3d.cpp:831, ERR_FAIL_COND(p_floor_snap_length < 0): the setter refuses.
  floor_snap_length: v.float('floor_snap_length', {
    min: 0,
    message: "Property 'floor_snap_length' must be >= 0",
    enforced: 'character_body_3d.cpp:831',
  }),
  // character_body_3d.cpp:927, PROPERTY_HINT_RANGE "0,180,0.1,radians_as_degrees";
  // the setter (:839-841) is a bare assignment, so out-of-range warns.
  wall_min_slide_angle: v.radians('wall_min_slide_angle', {
    minDeg: 0,
    maxDeg: 180,
    hinted: 'character_body_3d.cpp:927',
  }),
  // character_body_3d.cpp:937 "Add Velocity,Add Upward Velocity,Do Nothing". The
  // setter (:801-803) is a bare assignment, so out-of-range warns.
  platform_on_leave: v.enumInt('platform_on_leave', 0, 2, PLATFORM_ON_LEAVE, {
    hinted: 'character_body_3d.cpp:937',
  }),
  // character_body_3d.cpp:938/939, PROPERTY_HINT_LAYERS_3D_PHYSICS (no range
  // hint). Shares the layerBitmask() factory instead of hand-inlining the same
  // 0..4294967295 bound.
  platform_floor_layers: layerBitmask('platform_floor_layers', { hinted: 'character_body_3d.cpp:938', width: 'uint32' /* character_body_3d.h:103 */ }),
  platform_wall_layers: layerBitmask('platform_wall_layers', { hinted: 'character_body_3d.cpp:939', width: 'uint32' /* character_body_3d.h:106 */ }),
  // character_body_3d.cpp:942 hints "0.001,256,0.001,suffix:m", closed both
  // ends; set_safe_margin (:637) is a bare assignment, so both ends warn.
  safe_margin: v.float('safe_margin', {
    min: 0.001,
    max: 256,
    hinted: 'character_body_3d.cpp:942',
  }),
  // character_body_3d.cpp:813, ERR_FAIL_COND(p_max_slides < 1): the setter refuses.
  max_slides: v.positiveInt(
    'max_slides',
    "Property 'max_slides' must be greater than 0. Character needs at least 1 slide iteration to function.",
    { enforced: 'character_body_3d.cpp:813' }
  ),
});
