/**
 * Bone2D strict validators for linting: `rest` (skeleton_2d.cpp:380) and four
 * `_get_property_list` keys that doc/classes/Bone2D.xml documents as methods only.
 * `default_length`, an alias for `length` with no `PropertyInfo`
 * (skeleton_2d.cpp:48-49,70-71), is resolved by `godot/deprecated.ts`.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Bone2D', {
  // The class's one ADD_PROPERTY, PropertyInfo(Variant::TRANSFORM2D, "rest",
  // PROPERTY_HINT_NONE, "suffix:px") at skeleton_2d.cpp:380, and set_rest (:383)
  // stores it unaltered, so the shape is the whole constraint. The all-zero default
  // draws a configuration warning, never a refusal.
  rest: v.transform2d('rest'),

  // This key and the three below come from a hand-rolled `_get_property_list`
  // (skeleton_2d.cpp:85-95) through `_set`/`_get` (`:41-83`). skeleton_2d.cpp:86
  // pushes PropertyInfo(Variant::BOOL, …, PROPERTY_HINT_NONE).
  auto_calculate_length_and_angle: v.boolean('auto_calculate_length_and_angle'),

  // Pushed only while `auto_calculate_length_and_angle` is false (skeleton_2d.cpp:87),
  // like `bone_angle`. skeleton_2d.cpp:88 hints "1, 1024, 1", both ends closed, and
  // set_length (:463-469) assigns with no clamp and no ERR_FAIL: a warning.
  length: v.float('length', { min: 1, max: 1024, hinted: 'skeleton_2d.cpp:88' }),

  // Degrees: the hint at skeleton_2d.cpp:89 is "-360, 360, 0.01" with no
  // `radians_as_degrees`, since `_set` applies deg_to_rad (:47) and `_get` rad_to_deg
  // (:69). set_bone_angle (:475-481) assigns straight through, so out of range is a
  // warning.
  bone_angle: v.float('bone_angle', { min: -360, max: 360, hinted: 'skeleton_2d.cpp:89' }),

  // BOOL, PROPERTY_HINT_NONE, pushed at skeleton_2d.cpp:93 inside `#ifdef
  // TOOLS_ENABLED`. It carries PROPERTY_USAGE_DEFAULT, which includes STORAGE, and
  // only editor builds write `.tscn` files, so a scene can store the key.
  'editor_settings/show_bone_gizmo': v.boolean('editor_settings/show_bone_gizmo'),
});
