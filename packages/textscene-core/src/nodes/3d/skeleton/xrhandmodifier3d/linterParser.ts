/**
 * XRHandModifier3D strict validators. Both keys arrive through the `ADD_PROPERTY` pair at
 * xr_hand_modifier_3d.cpp:43-44: no `_set`/`_get`, `get_property_list`, `PropertyListHelper`,
 * `ADD_ARRAY_COUNT` or xr_hand_modifier_3d.compat.inc. The two setters land in opposite tiers
 * (ADR-0032): `set_bone_update` refuses out-of-range values, and `set_hand_tracker` takes anything.
 */

// Declare only XRHandModifier3D's own members, the ones doc/classes/XRHandModifier3D.xml lists
// without `overrides=`. The NODE_BASE_TYPES base-walk delivers every key from SkeletonModifier3D
// up, and re-declaring one shadows it and duplicates the rule.
import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

/**
 * `XRHandModifier3D::BoneUpdate` (xr_hand_modifier_3d.h:45-49), in the `BIND_ENUM_CONSTANT`
 * spelling at xr_hand_modifier_3d.cpp:46-48 minus the prefix. `BONE_UPDATE_MAX` (2) is the size
 * marker, not a mode: the hint at :44 omits it and the setter rejects it, so hint and setter agree
 * on 0-1.
 */
const BONE_UPDATE = { 0: 'FULL', 1: 'ROTATION_ONLY' } as const;

validatorRegistry.registerAll('XRHandModifier3D', {
  // xr_hand_modifier_3d.cpp:44, PROPERTY_HINT_ENUM "Full,Rotation Only".
  // set_bone_update (:63-66) opens with ERR_FAIL_INDEX(p_bone_update,
  // BONE_UPDATE_MAX), which returns before the assignment for anything below 0
  // or at/above 2. A refused write is an error, not a hint warning.
  bone_update: v.enumInt('bone_update', 0, 1, BONE_UPDATE, {
    enforced: 'xr_hand_modifier_3d.cpp:64',
  }),

  // xr_hand_modifier_3d.cpp:43 declares Variant::STRING, but get_hand_tracker (:59) returns
  // StringName, so Godot writes &"/user/hand_tracker/left", which `v.stringName` reads. Format
  // only: PROPERTY_HINT_ENUM_SUGGESTION "still accepts arbitrary values and can be empty"
  // (@GlobalScope.xml:2786), and set_hand_tracker (:51-57) assigns unconditionally (ADR-0032).
  hand_tracker: v.stringName('hand_tracker'),
});
