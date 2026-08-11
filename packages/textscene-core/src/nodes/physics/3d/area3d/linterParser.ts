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
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';import { SPACE_OVERRIDE } from '../../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../../linter/validators/index.js';


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
  // area_3d.cpp:800 declares Variant::STRING_NAME, and the getter returns
  // StringName (area_3d.cpp:601), so the serialised form is &"Master" or the
  // plain "Master" the text parser also accepts — never a bare word.
  audio_bus_name: v.stringName('audio_bus_name'),
  // area_3d.cpp:794, PROPERTY_HINT_RANGE "0,10,0.001,or_greater": or_greater
  // opens the max. set_wind_force_magnitude (:134-137) is a bare assignment,
  // so out-of-range warns.
  wind_force_magnitude: v.float('wind_force_magnitude', {
    min: 0,
    hinted: 'area_3d.cpp:794',
  }),
  // area_3d.cpp:795, PROPERTY_HINT_RANGE "0.0,3.0,0.001,or_greater": or_greater
  // opens the max. set_wind_attenuation_factor (:145-148) is a bare
  // assignment, so out-of-range warns.
  wind_attenuation_factor: v.float('wind_attenuation_factor', {
    min: 0,
    hinted: 'area_3d.cpp:795',
  }),
  // area_3d.cpp:796, Variant::NODE_PATH. set_wind_source_path (:156-159) is a
  // bare assignment: format-only. NodePath("") is legal (:173 treats an empty
  // path as "no wind source").
  wind_source_path: v.nodePath('wind_source_path'),
  // area_3d.cpp:803, PROPERTY_HINT_GROUP_ENABLE (bool group toggle).
  reverb_bus_enabled: v.boolean('reverb_bus_enabled'),
  // area_3d.cpp:804 declares Variant::STRING_NAME; set_reverb_bus_name
  // (:618-620) is a bare assignment. The ENUM hint's option list is populated
  // dynamically in _validate_property, editor-only, so it carries no bound to
  // check against a saved value.
  reverb_bus_name: v.stringName('reverb_bus_name'),
  // area_3d.cpp:805, PROPERTY_HINT_RANGE "0,1,0.01". set_reverb_amount
  // (:631-633) is a bare assignment, so out-of-range warns.
  reverb_bus_amount: v.float('reverb_bus_amount', {
    min: 0,
    max: 1,
    hinted: 'area_3d.cpp:805',
  }),
  // area_3d.cpp:806, PROPERTY_HINT_RANGE "0,1,0.01". set_reverb_uniformity
  // (:639-641) is a bare assignment, so out-of-range warns.
  reverb_bus_uniformity: v.float('reverb_bus_uniformity', {
    min: 0,
    max: 1,
    hinted: 'area_3d.cpp:806',
  }),
});
