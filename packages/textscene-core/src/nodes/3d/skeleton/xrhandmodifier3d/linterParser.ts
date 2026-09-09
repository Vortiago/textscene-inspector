/**
 * XRHandModifier3D strict validators for linting.
 *
 * Declare only XRHandModifier3D's OWN members, the ones doc/classes/XRHandModifier3D.xml
 * lists without an `overrides=` attribute. Everything from SkeletonModifier3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Both keys arrive by ONE route, the `ADD_PROPERTY` pair at
 * xr_hand_modifier_3d.cpp:43-44. The class declares no `_set`/`_get`, no
 * `get_property_list`, no `PropertyListHelper` and no `ADD_ARRAY_COUNT`, and
 * there is no `xr_hand_modifier_3d.compat.inc`, so nothing else reaches a `.tscn`.
 *
 * The two setters land in opposite tiers (ADR-0032), which is the whole story
 * here: `set_bone_update` refuses out-of-range values outright while
 * `set_hand_tracker` takes anything at all.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

/**
 * `XRHandModifier3D::BoneUpdate` (xr_hand_modifier_3d.h:45-49), in the
 * `BIND_ENUM_CONSTANT` spelling at xr_hand_modifier_3d.cpp:46-48 minus the
 * shared prefix.
 *
 * The third constant, `BONE_UPDATE_MAX` (2), is the enum's size marker rather
 * than a mode: the hint at :44 lists only "Full,Rotation Only" and the setter
 * rejects it, so hint and setter agree exactly on 0-1 and no legal-but-unhinted
 * gap exists. No deprecated member is listed.
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

  // xr_hand_modifier_3d.cpp:43 declares Variant::STRING, but get_hand_tracker
  // (:59) returns StringName and the GETTER decides the serialised form: Godot
  // writes &"/user/hand_tracker/left". `v.stringName` takes that and the plain
  // quoted form the variant text parser also reads; `v.quotedString` would
  // reject what the engine itself saves.
  //
  // Format only, no bound. The hint is PROPERTY_HINT_ENUM_SUGGESTION, which
  // "still accepts arbitrary values and can be empty" (@GlobalScope.xml:2786),
  // and set_hand_tracker (:51-57) assigns unconditionally, so a name outside
  // the two suggestions is neither an error nor a warning (ADR-0032).
  hand_tracker: v.stringName('hand_tracker'),
});
