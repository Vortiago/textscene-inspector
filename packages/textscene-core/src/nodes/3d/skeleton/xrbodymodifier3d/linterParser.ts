/**
 * XRBodyModifier3D strict validators for linting.
 *
 * Declare only XRBodyModifier3D's OWN members - the ones
 * doc/classes/XRBodyModifier3D.xml lists without an `overrides=` attribute.
 * Everything from SkeletonModifier3D up is registered on the ancestor and
 * delivered by the NODE_BASE_TYPES base-walk, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 *
 * Three `ADD_PROPERTY` calls (xr_body_modifier_3d.cpp:46-48) are the whole
 * surface: the class declares no `_set`/`_get`, no `get_property_list`, no
 * `_validate_property`, no `PropertyListHelper` and no `ADD_ARRAY_COUNT`, and
 * ships no `.compat.inc`, so nothing else of its own reaches a `.tscn`.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, v } from '../../../../linter/validators/index.js';

/**
 * XRBodyModifier3D::BodyUpdate (xr_body_modifier_3d.h:48-50).
 *
 * The enum has no combined "all" constant, so every bit here is a real flag and
 * their OR, 7, is the property default (xr_body_modifier_3d.h:83).
 */
const BODY_UPDATE_FLAGS: Record<number, string> = {
  1: 'BODY_UPDATE_UPPER_BODY',
  2: 'BODY_UPDATE_LOWER_BODY',
  4: 'BODY_UPDATE_HANDS',
};

validatorRegistry.registerAll('XRBodyModifier3D', {
  // xr_body_modifier_3d.cpp:46 - PROPERTY_HINT_ENUM_SUGGESTION "/user/body_tracker",
  // which only seeds the inspector's dropdown and still accepts any string, so it
  // states no bound at all. set_body_tracker bare-assigns (:60). ADD_PROPERTY
  // declares Variant::STRING but the GETTER returns StringName
  // (xr_body_modifier_3d.h:60), so Godot serialises it &"..."; `v.stringName`
  // takes that spelling and the plain quoted one the variant parser also reads.
  body_tracker: v.stringName('body_tracker'),
  // xr_body_modifier_3d.cpp:47 - PROPERTY_HINT_FLAGS "Upper Body,Lower Body,Hands",
  // so the inspector offers bits 1, 2 and 4. set_body_update bare-assigns (:68)
  // with no mask, so a bit outside that set is KEPT rather than dropped: the value
  // loads and runs and is merely unreachable from the editor, which is the hint
  // tier and not the setter tier (contrast `maskedBitField`).
  body_update: hintedBitField('body_update', {
    hinted: 'xr_body_modifier_3d.cpp:47',
    labels: BODY_UPDATE_FLAGS,
  }),
  // xr_body_modifier_3d.cpp:48 - PROPERTY_HINT_ENUM "Full,Rotation Only".
  // set_bone_update opens with ERR_FAIL_INDEX(p_bone_update, BONE_UPDATE_MAX)
  // (:80), and BONE_UPDATE_MAX is 2 (xr_body_modifier_3d.h:56), so the setter
  // REFUSES anything outside 0-1 and leaves the previous value standing. Both
  // ends are enforced, which is why this is the error tier while `body_update`
  // beside it is not.
  bone_update: v.enumInt(
    'bone_update',
    0,
    1,
    { 0: 'BONE_UPDATE_FULL', 1: 'BONE_UPDATE_ROTATION_ONLY' },
    { enforced: 'xr_body_modifier_3d.cpp:80' }
  ),
});
