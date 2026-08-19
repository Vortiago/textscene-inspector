/**
 * Area2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * The space-override family goes through `v.enumInt`, matching Area3D, rather
 * than the hand-rolled `createSpaceOverrideValidator` it used to call: that
 * helper predated the ADR-0032 grounding mechanism and could not carry a
 * citation. It had no other caller once Area2D moved off it, so it is gone.
 *
 * `space_override` (bare, no `gravity_`/`linear_damp_`/`angular_damp_`
 * prefix) is deliberately absent: area_2d.cpp has no matching `ADD_PROPERTY`
 * and doc/classes/Area2D.xml has no matching member. Only
 * `gravity_space_override`, `linear_damp_space_override` and
 * `angular_damp_space_override` are real `SpaceOverride` members.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';import { SPACE_OVERRIDE } from '../../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../../linter/validators/index.js';


validatorRegistry.registerAll('Area2D', {
  monitoring: v.boolean('monitoring'),
  monitorable: v.boolean('monitorable'),

  // area_2d.cpp:653 "Disabled,Combine,Combine-Replace,Replace,Replace-Combine".
  // The setters (:35-38 etc) are bare assignments, so out-of-range warns.
  gravity_space_override: v.enumInt('gravity_space_override', 0, 4, SPACE_OVERRIDE, {
    hinted: 'area_2d.cpp:653',
  }),
  gravity_point: v.boolean('gravity_point'),
  gravity_point_center: v.vector2('gravity_point_center'),
  // area_2d.cpp:655, PROPERTY_HINT_RANGE "0,1024,0.001,or_greater,exp,suffix:px":
  // 0 is legal and IS the default (constant point gravity, no falloff); the
  // setter (:53-56) is a bare assignment, so out-of-range warns.
  gravity_point_unit_distance: v.float('gravity_point_unit_distance', {
    min: 0,
    message: "Property 'gravity_point_unit_distance' must be at least 0.",
    hinted: 'area_2d.cpp:655',
  }),
  gravity_direction: v.vector2('gravity_direction'),
  gravity: v.float('gravity'),
  // area_2d.cpp:661. The setter (:89-92) is a bare assignment, so out-of-range warns.
  linear_damp_space_override: v.enumInt('linear_damp_space_override', 0, 4, SPACE_OVERRIDE, {
    hinted: 'area_2d.cpp:661',
  }),
  // area_2d.cpp:662, PROPERTY_HINT_RANGE "0,100,0.001,or_greater". The setter
  // (:107-110) is a bare assignment, so out-of-range warns.
  linear_damp: v.float('linear_damp', {
    min: 0,
    message: "Property 'linear_damp' must be >= 0. Damping cannot be negative.",
    hinted: 'area_2d.cpp:662',
  }),
  // area_2d.cpp:665. The setter (:98-101) is a bare assignment, so out-of-range warns.
  angular_damp_space_override: v.enumInt('angular_damp_space_override', 0, 4, SPACE_OVERRIDE, {
    hinted: 'area_2d.cpp:665',
  }),
  // area_2d.cpp:666, PROPERTY_HINT_RANGE "0,100,0.001,or_greater". The setter
  // (:116-119) is a bare assignment, so out-of-range warns.
  angular_damp: v.float('angular_damp', {
    min: 0,
    message: "Property 'angular_damp' must be >= 0. Damping cannot be negative.",
    hinted: 'area_2d.cpp:666',
  }),
  // `Variant::INT` with `set_priority(int)` (area_2d.cpp:650); both hint ends are
  // opened by `or_greater,or_less`, so the slot itself is the only authority.
  // Modelled as a float, it was the one key in the tree outside the int-slot
  // population, so neither the truncation warning nor the unstorable-value
  // error ever fired on it.
  priority: v.strictInt('priority'),
  audio_bus_override: v.boolean('audio_bus_override'),
  // area_2d.cpp:670 declares Variant::STRING_NAME, and the getter returns
  // StringName (area_2d.cpp:534), so the serialised form is &"Master" or the
  // plain "Master" the text parser also accepts — never a bare word.
  audio_bus_name: v.stringName('audio_bus_name'),
});
