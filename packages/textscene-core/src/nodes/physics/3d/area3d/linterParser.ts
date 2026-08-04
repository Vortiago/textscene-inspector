/**
 * Area3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `space_override` (bare, no `gravity_`/`linear_damp_`/`angular_damp_`
 * prefix) is deliberately absent: area_3d.cpp has no matching `ADD_PROPERTY`
 * and doc/classes/Area3D.xml has no matching member. Only
 * `gravity_space_override`, `linear_damp_space_override` and
 * `angular_damp_space_override` are real `SpaceOverride` members.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const SPACE_OVERRIDE = {
  0: 'DISABLED',
  1: 'COMBINE',
  2: 'COMBINE_REPLACE',
  3: 'REPLACE',
  4: 'REPLACE_COMBINE',
};

validatorRegistry.registerAll('Area3D', {
  monitoring: v.boolean('monitoring'),
  monitorable: v.boolean('monitorable'),
  // area_3d.cpp:778 "Disabled,Combine,Combine-Replace,Replace,Replace-Combine".
  // The setters (:35-38 etc) are bare assignments, so out-of-range warns.
  gravity_space_override: v.enumInt('gravity_space_override', 0, 4, SPACE_OVERRIDE, {
    hinted: 'area_3d.cpp:778',
  }),
  gravity_point: v.boolean('gravity_point'),
  gravity_point_center: v.vector3('gravity_point_center'),
  // area_3d.cpp:780, PROPERTY_HINT_RANGE "0,1024,0.001,or_greater,exp,suffix:m":
  // 0 is legal and IS the default (constant point gravity, no falloff); the
  // setter (:53-56) is a bare assignment, so out-of-range warns.
  gravity_point_unit_distance: v.float('gravity_point_unit_distance', {
    min: 0,
    message: "Property 'gravity_point_unit_distance' must be at least 0.",
    hinted: 'area_3d.cpp:780',
  }),
  gravity_direction: v.vector3('gravity_direction'),
  gravity: v.float('gravity'),
  // area_3d.cpp:786. The setter (:89-92) is a bare assignment, so out-of-range warns.
  linear_damp_space_override: v.enumInt('linear_damp_space_override', 0, 4, SPACE_OVERRIDE, {
    hinted: 'area_3d.cpp:786',
  }),
  // area_3d.cpp:787, PROPERTY_HINT_RANGE "0,100,0.001,or_greater". The setter
  // (:107-110) is a bare assignment, so out-of-range warns.
  linear_damp: v.float('linear_damp', {
    min: 0,
    message: "Property 'linear_damp' must be >= 0. Damping cannot be negative.",
    hinted: 'area_3d.cpp:787',
  }),
  // area_3d.cpp:790. The setter (:98-101) is a bare assignment, so out-of-range warns.
  angular_damp_space_override: v.enumInt('angular_damp_space_override', 0, 4, SPACE_OVERRIDE, {
    hinted: 'area_3d.cpp:790',
  }),
  // area_3d.cpp:791, PROPERTY_HINT_RANGE "0,100,0.001,or_greater". The setter
  // (:116-119) is a bare assignment, so out-of-range warns.
  angular_damp: v.float('angular_damp', {
    min: 0,
    message: "Property 'angular_damp' must be >= 0. Damping cannot be negative.",
    hinted: 'area_3d.cpp:791',
  }),
  priority: v.float('priority'),
  audio_bus_override: v.boolean('audio_bus_override'),
  audio_bus_name: v.string('audio_bus_name'),
});
