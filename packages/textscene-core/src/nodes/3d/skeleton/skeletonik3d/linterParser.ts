/**
 * SkeletonIK3D strict validators for linting.
 *
 * Declare only SkeletonIK3D's OWN members — the ones doc/classes/SkeletonIK3D.xml
 * lists without an `overrides=` attribute. Everything from SkeletonModifier3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule. `active` and
 * `influence` are SkeletonModifier3D's and are deliberately absent here.
 *
 * ## The class is deprecated, and still serialises
 *
 * `GDREGISTER_CLASS(SkeletonIK3D)` sits inside `#ifndef DISABLE_DEPRECATED`
 * (register_scene_types.cpp:720-722), so a build with that flag has no such class
 * at all, and the XML tags both the class and its `interpolation` member
 * `deprecated`. A stock 4.6 build registers it, saves it and reloads it, so every
 * key below is one a real scene carries and a linter has to check. Deprecation
 * changes what a reader should reach for, not what the file means.
 *
 * ## Nine keys, one route, no bounds
 *
 * All nine come from `ADD_PROPERTY` in `_bind_methods` (skeleton_ik_3d.cpp:353-361).
 * There is no `PropertyListHelper`, no `ADD_ARRAY_COUNT` and no `.compat.inc`; the
 * class declaration's `protected:` section holds only `_validate_property`,
 * `_bind_methods`, `_notification` and `_process_modification`
 * (skeleton_ik_3d.h:139-145), so no property-list hook exists under either
 * spelling — `_set_interpolation` and `_get_target_transform` are private helpers,
 * not `Object::_set`/`_get`.
 *
 * Every setter (skeleton_ik_3d.cpp:399-476) is a bare field assignment followed at
 * most by `reload_chain()` / `reload_goal()`. No `ERR_FAIL*`, no clamp, no mask, no
 * truncation, no `is_finite` guard, and the file's only `PROPERTY_HINT_RANGE` is on
 * `interpolation`, which never serialises. So no bound is grounded in either tier
 * (ADR-0032) and every validator here is `formatOnly`. A floor of 0 on
 * `min_distance` or `max_iterations` would look natural and reject values Godot
 * assigns unaltered.
 *
 * Nothing carries a `radians_as_degrees` hint, so no degree-to-radian conversion
 * applies, and the class has no bone INDEX property at all — `root_bone` and
 * `tip_bone` are StringNames — so the `min: -1` shape four sibling slices ship does
 * not arise here.
 *
 * `interpolation` (skeleton_ik_3d.cpp:366) gets no validator: PROPERTY_USAGE_NONE
 * has no STORAGE bit, so it never reaches a `.tscn`, and its body only forwards to
 * `set_influence` (skeleton_ik_3d.cpp:419), SkeletonModifier3D's key.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SkeletonIK3D', {
  // skeleton_ik_3d.cpp:353, Variant::STRING_NAME, no hint. set_root_bone
  // (skeleton_ik_3d.cpp:399-402) assigns and rebuilds the chain.
  //
  // `v.stringName`, not `v.quotedString`: Godot writes a StringName as `&"Bone"`
  // and the variant text parser also reads a plain `"Bone"`, so both spellings
  // appear in real scenes. And not `v.enumInt` either, though
  // `_validate_property` (skeleton_ik_3d.cpp:307-315) does hand this key a
  // PROPERTY_HINT_ENUM: that runs only under `is_editor_hint()`
  // (skeleton_ik_3d.cpp:304), and its members are
  // `Skeleton3D::get_concatenated_bone_names()` — live scene state no
  // per-property validator can see.
  root_bone: v.stringName('root_bone'),
  // skeleton_ik_3d.cpp:354, as root_bone. set_tip_bone (skeleton_ik_3d.cpp:408-411).
  tip_bone: v.stringName('tip_bone'),
  // skeleton_ik_3d.cpp:355, Variant::TRANSFORM3D, PROPERTY_HINT_NONE with a bare
  // "suffix:m" (a unit label, not a bound). set_target_transform
  // (skeleton_ik_3d.cpp:427-430) assigns and reloads the goal.
  target: v.transform3d('target'),
  // skeleton_ik_3d.cpp:356, Variant::BOOL, no hint. set_override_tip_basis
  // (skeleton_ik_3d.cpp:446-448) is a bare assignment.
  override_tip_basis: v.boolean('override_tip_basis'),
  // skeleton_ik_3d.cpp:357, Variant::BOOL, no hint. set_use_magnet
  // (skeleton_ik_3d.cpp:454-456) is a bare assignment.
  //
  // That `magnet` is only read when this is true and the chain has a middle item
  // (skeleton_ik_3d.cpp:250) is a runtime no-op, not a dropped write: the setter
  // always stores, `_validate_property` never hides the key, so Godot's own
  // inspector saves the pair. There is no diagnostic in it.
  use_magnet: v.boolean('use_magnet'),
  // skeleton_ik_3d.cpp:358, Variant::VECTOR3, PROPERTY_HINT_NONE with a bare
  // "suffix:m". set_magnet_position (skeleton_ik_3d.cpp:462-464) is a bare
  // assignment, so a non-finite component loads unaltered.
  magnet: v.vector3('magnet'),
  // skeleton_ik_3d.cpp:359, Variant::NODE_PATH, no hint. set_target_node
  // (skeleton_ik_3d.cpp:436-440) assigns the path and clears the cached
  // reference. An empty path is the default and simply leaves `target` in use
  // (skeleton_ik_3d.cpp:501-514).
  target_node: v.nodePath('target_node'),
  // skeleton_ik_3d.cpp:360, Variant::FLOAT, PROPERTY_HINT_NONE with a bare
  // "suffix:m". set_min_distance (skeleton_ik_3d.cpp:470-472) is a bare
  // assignment: no floor, no ceiling, no is_finite guard, so `v.float` is left
  // unbounded rather than given the 0 floor the name suggests.
  min_distance: v.float('min_distance'),
  // skeleton_ik_3d.cpp:361, Variant::INT, no hint. set_max_iterations
  // (skeleton_ik_3d.cpp:474-476) is a bare assignment and `reload_chain` copies
  // the value onto the solver task unchanged (skeleton_ik_3d.cpp:528).
  //
  // `v.strictInt`, not `v.int`: an iteration count is discrete, and `v.int`
  // would read `10.5` as 10 rather than reporting it.
  max_iterations: v.strictInt('max_iterations'),
});
