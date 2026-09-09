/**
 * RetargetModifier3D strict validators for linting.
 *
 * Declare only RetargetModifier3D's OWN members - the ones
 * doc/classes/RetargetModifier3D.xml lists without an `overrides=` attribute.
 * Everything from SkeletonModifier3D up is registered on the ancestor and
 * delivered by the NODE_BASE_TYPES base-walk, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 *
 * Three `ADD_PROPERTY` calls (retarget_modifier_3d.cpp:273-275) are the whole
 * surface: the class declares no `_set`/`_get`, no `get_property_list`, no
 * `PropertyListHelper` and no `ADD_ARRAY_COUNT`, so nothing else of its own
 * reaches a `.tscn`.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, v } from '../../../../linter/validators/index.js';

/**
 * RetargetModifier3D::TransformFlag (retarget_modifier_3d.h:41-43).
 *
 * TRANSFORM_FLAG_ALL (:44) is deliberately absent: it is the OR of the three,
 * not a fourth bit, and listing it would name 7 as if it were one flag.
 */
const TRANSFORM_FLAGS: Record<number, string> = {
  1: 'TRANSFORM_FLAG_POSITION',
  2: 'TRANSFORM_FLAG_ROTATION',
  4: 'TRANSFORM_FLAG_SCALE',
};

validatorRegistry.registerAll('RetargetModifier3D', {
  // retarget_modifier_3d.cpp:273 - Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE
  // "SkeletonProfile". The hint narrows the inspector's resource picker, not the
  // .tscn grammar, and set_profile (:381-386) hands any Ref to _profile_changed
  // with no guard, so only the reference's spelling is checkable here.
  profile: v.resourceReference('profile'),
  // retarget_modifier_3d.cpp:274 - Variant::BOOL, PROPERTY_HINT_NONE.
  // set_use_global_pose (:392-401) assigns unconditionally.
  use_global_pose: v.boolean('use_global_pose'),
  // retarget_modifier_3d.cpp:275 - PROPERTY_HINT_FLAGS "Position,Rotation,Scale",
  // so the inspector offers bits 1, 2 and 4. set_enable_flags bare-assigns
  // (:411) with no mask, so a bit outside that set is KEPT rather than dropped:
  // it loads and runs and is merely unreachable from the inspector, which is the
  // hint tier and not the setter tier (contrast `maskedBitField`).
  enable: hintedBitField('enable', {
    hinted: 'retarget_modifier_3d.cpp:275',
    labels: TRANSFORM_FLAGS,
  }),
});
