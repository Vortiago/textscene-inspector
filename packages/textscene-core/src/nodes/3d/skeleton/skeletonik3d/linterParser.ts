/**
 * SkeletonIK3D strict validators. Declare only its own members, the ones
 * doc/classes/SkeletonIK3D.xml lists without `overrides=`. The class is deprecated but still
 * serialises: `GDREGISTER_CLASS(SkeletonIK3D)` sits inside `#ifndef DISABLE_DEPRECATED`
 * (register_scene_types.cpp:720-722), and a stock 4.6 build saves and reloads it.
 */

// The NODE_BASE_TYPES base-walk delivers every key from SkeletonModifier3D up, `active` and
// `influence` among them. Re-declaring one shadows it and duplicates the rule.
import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// All nine keys come from `ADD_PROPERTY` (skeleton_ik_3d.cpp:353-361): there is no `.compat.inc`,
// and the protected section (skeleton_ik_3d.h:139-145) has no property-list hook. Every setter
// (skeleton_ik_3d.cpp:399-476) is a bare assignment, and none carries `radians_as_degrees`, so no
// bound is grounded in either tier (ADR-0032).
validatorRegistry.registerAll('SkeletonIK3D', {
  // skeleton_ik_3d.cpp:353, Variant::STRING_NAME, no hint. set_root_bone
  // (skeleton_ik_3d.cpp:399-402) assigns and rebuilds the chain. `v.stringName` reads `&"Bone"` and
  // `"Bone"`. `_validate_property` (skeleton_ik_3d.cpp:307-315) adds an enum of live bone names
  // only under `is_editor_hint()` (skeleton_ik_3d.cpp:304).
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
  // skeleton_ik_3d.cpp:357, Variant::BOOL, no hint. set_use_magnet (skeleton_ik_3d.cpp:454-456) is
  // a bare assignment. `magnet` is read only when this is true and the chain has a middle item
  // (skeleton_ik_3d.cpp:250), a runtime no-op and not a dropped write, so there is no diagnostic.
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
  // skeleton_ik_3d.cpp:361, Variant::INT, no hint. set_max_iterations (skeleton_ik_3d.cpp:474-476)
  // assigns, and `reload_chain` copies the value to the solver unchanged (skeleton_ik_3d.cpp:528).
  // `v.strictInt` (an INT slot, not `formatOnly`): an iteration count is discrete, so `10.5` is
  // reported.
  max_iterations: v.strictInt('max_iterations'),
  // No `interpolation` (skeleton_ik_3d.cpp:366): PROPERTY_USAGE_NONE has no STORAGE bit, and the
  // setter only forwards to `set_influence` (skeleton_ik_3d.cpp:419), SkeletonModifier3D's key.
  // `_set_interpolation` and `_get_target_transform` are private helpers, not `Object::_set`/`_get`.
});
