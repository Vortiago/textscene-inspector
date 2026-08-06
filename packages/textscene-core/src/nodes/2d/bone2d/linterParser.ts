/**
 * Bone2D strict validators for linting.
 *
 * Declare only Bone2D's OWN members: the ones doc/classes/Bone2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Bone2D reaches a `.tscn` by TWO routes, and reading only the first finds one
 * property out of five: `rest` is the class's single ADD_PROPERTY
 * (skeleton_2d.cpp:380), while `auto_calculate_length_and_angle`, `length`,
 * `bone_angle` and `editor_settings/show_bone_gizmo` are pushed by a hand-rolled
 * `_get_property_list` (skeleton_2d.cpp:85-95) and round-tripped through `_set`
 * / `_get` (`:41-83`). The XML documents the last four as methods only, so its
 * member list names just `rest`.
 *
 * `length` and `bone_angle` are pushed only while
 * `auto_calculate_length_and_angle` is false (skeleton_2d.cpp:87): with
 * autocalculation on, Godot recomputes both from the first child Bone2D and
 * neither serialises.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Bone2D', {
  // ADD_PROPERTY(PropertyInfo(Variant::TRANSFORM2D, "rest", PROPERTY_HINT_NONE,
  // "suffix:px")) at skeleton_2d.cpp:380 carries no hint bound, and set_rest
  // (:383) stores the transform unaltered, so the shape is the whole
  // constraint. The all-zero default draws a configuration warning in the
  // editor, never a refusal.
  rest: v.transform2d('rest'),

  // skeleton_2d.cpp:86 pushes PropertyInfo(Variant::BOOL, …, PROPERTY_HINT_NONE).
  auto_calculate_length_and_angle: v.boolean('auto_calculate_length_and_angle'),

  // skeleton_2d.cpp:88 hints "1, 1024, 1" with neither `or_greater` nor
  // `or_less`, so both ends are closed; set_length (:463-469) assigns straight
  // through with no clamp and no ERR_FAIL, which under ADR-0032 makes the bound
  // the inspector widget's and out of range a warning.
  length: v.float('length', { min: 1, max: 1024, hinted: 'skeleton_2d.cpp:88' }),

  // DEGREES, not radians. The hint at skeleton_2d.cpp:89 is "-360, 360, 0.01"
  // with no `radians_as_degrees` token, and the conversion sits in the accessors
  // instead: `_set` applies deg_to_rad (:47) and `_get` applies rad_to_deg
  // (:69), so the serialised literal is already in degrees and the hint's
  // numbers apply to it unconverted. set_bone_angle (:475-481) assigns straight
  // through, so out of range is a warning, same as `length`.
  bone_angle: v.float('bone_angle', { min: -360, max: 360, hinted: 'skeleton_2d.cpp:89' }),

  // BOOL, PROPERTY_HINT_NONE, pushed at skeleton_2d.cpp:93 inside `#ifdef
  // TOOLS_ENABLED`. Editor-only does not mean unserialised: it carries
  // PROPERTY_USAGE_DEFAULT, which includes STORAGE, and only editor builds
  // write `.tscn` files at all, so a scene saved with the bone gizmo toggled
  // off stores the key.
  'editor_settings/show_bone_gizmo': v.boolean('editor_settings/show_bone_gizmo'),
});
