/**
 * XRBodyModifier3D strict validators. Three `ADD_PROPERTY` calls (xr_body_modifier_3d.cpp:46-48)
 * are the whole surface: no `_set`/`_get`, `get_property_list`, `_validate_property`,
 * `PropertyListHelper`, `ADD_ARRAY_COUNT` or `.compat.inc`.
 */

// Declare only XRBodyModifier3D's own members, the ones doc/classes/XRBodyModifier3D.xml lists
// without `overrides=`. The NODE_BASE_TYPES base-walk delivers every key from SkeletonModifier3D
// up, and re-declaring one shadows it and duplicates the rule.
import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, v } from '../../../../linter/validators/index.js';

/**
 * XRBodyModifier3D::BodyUpdate (xr_body_modifier_3d.h:48-50). The enum has no combined "all"
 * constant, so every bit here is a real flag, and their OR, 7, is the property default
 * (xr_body_modifier_3d.h:83).
 */
const BODY_UPDATE_FLAGS: Record<number, string> = {
  1: 'BODY_UPDATE_UPPER_BODY',
  2: 'BODY_UPDATE_LOWER_BODY',
  4: 'BODY_UPDATE_HANDS',
};

validatorRegistry.registerAll('XRBodyModifier3D', {
  // xr_body_modifier_3d.cpp:46: PROPERTY_HINT_ENUM_SUGGESTION "/user/body_tracker" still accepts
  // any string, and set_body_tracker bare-assigns (:60), so there is no bound. The getter returns
  // StringName (xr_body_modifier_3d.h:60), not the declared Variant::STRING, so Godot writes
  // `&"..."`, and `v.stringName` reads it and the plain quoted form.
  body_tracker: v.stringName('body_tracker'),
  // xr_body_modifier_3d.cpp:47: PROPERTY_HINT_FLAGS "Upper Body,Lower Body,Hands" offers bits 1, 2
  // and 4. set_body_update (:68) bare-assigns with no mask, so another bit loads and runs, only
  // unreachable from the editor: the hint tier, not the setter tier (contrast `maskedBitField`).
  body_update: hintedBitField('body_update', {
    hinted: 'xr_body_modifier_3d.cpp:47',
    labels: BODY_UPDATE_FLAGS,
  }),
  // xr_body_modifier_3d.cpp:48: PROPERTY_HINT_ENUM "Full,Rotation Only". set_bone_update opens with
  // ERR_FAIL_INDEX(p_bone_update, BONE_UPDATE_MAX) (:80), and BONE_UPDATE_MAX is 2
  // (xr_body_modifier_3d.h:56), so the setter refuses anything outside 0-1: the error tier, unlike
  // `body_update`.
  bone_update: v.enumInt(
    'bone_update',
    0,
    1,
    { 0: 'BONE_UPDATE_FULL', 1: 'BONE_UPDATE_ROTATION_ONLY' },
    { enforced: 'xr_body_modifier_3d.cpp:80' }
  ),
});
