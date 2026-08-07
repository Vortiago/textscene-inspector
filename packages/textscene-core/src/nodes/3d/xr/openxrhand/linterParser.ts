/**
 * OpenXRHand strict validators for linting.
 *
 * Declare only OpenXRHand's OWN members — the ones doc/classes/OpenXRHand.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All five ADD_PROPERTY calls sit in one block (openxr_hand.cpp:55-59), each
 * with a non-empty setter and getter. openxr_hand.h declares no `_set`/`_get`/
 * `get_property_list` override under either spelling and no `ADD_ARRAY_COUNT`,
 * so ADD_PROPERTY is the only route a member takes here.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('OpenXRHand', {
  // openxr_hand.cpp:55, PROPERTY_HINT_ENUM "Left,Right". set_hand
  // (cpp:83-87) opens with ERR_FAIL_INDEX(p_hand, HAND_MAX), which returns
  // before the assignment, so an out-of-range value is refused, not merely
  // hinted.
  hand: v.enumInt('hand', 0, 1, { 0: 'Left', 1: 'Right' }, { enforced: 'openxr_hand.cpp:84' }),
  // openxr_hand.cpp:56, PROPERTY_HINT_ENUM "Unobstructed,Conform to
  // controller". set_motion_range (cpp:99-104) opens with
  // ERR_FAIL_INDEX(p_motion_range, MOTION_RANGE_MAX), refusing out-of-range.
  motion_range: v.enumInt(
    'motion_range',
    0,
    1,
    { 0: 'Unobstructed', 1: 'Conform to controller' },
    { enforced: 'openxr_hand.cpp:100' }
  ),
  // openxr_hand.cpp:57, PROPERTY_HINT_NODE_PATH_VALID_TYPES "Skeleton3D", a
  // filter on the inspector's node picker, not on the stored value.
  // set_hand_skeleton (cpp:93-97) is a bare assignment.
  hand_skeleton: v.nodePath('hand_skeleton'),
  // openxr_hand.cpp:58, PROPERTY_HINT_ENUM "OpenXR,Humanoid". set_skeleton_rig
  // (cpp:135-139) opens with ERR_FAIL_INDEX(p_skeleton_rig, SKELETON_RIG_MAX),
  // refusing out-of-range.
  skeleton_rig: v.enumInt(
    'skeleton_rig',
    0,
    1,
    { 0: 'OpenXR', 1: 'Humanoid' },
    { enforced: 'openxr_hand.cpp:136' }
  ),
  // openxr_hand.cpp:59, PROPERTY_HINT_ENUM "Full,Rotation Only".
  // set_bone_update (cpp:145-149) opens with ERR_FAIL_INDEX(p_bone_update,
  // BONE_UPDATE_MAX), refusing out-of-range.
  bone_update: v.enumInt(
    'bone_update',
    0,
    1,
    { 0: 'Full', 1: 'Rotation Only' },
    { enforced: 'openxr_hand.cpp:146' }
  ),
});
