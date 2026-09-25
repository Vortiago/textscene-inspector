/**
 * RetargetModifier3D validators: its own members only, the ones doc/classes/RetargetModifier3D.xml
 * lists without `overrides=`, since the base-walk delivers SkeletonModifier3D's. Three
 * `ADD_PROPERTY` calls (retarget_modifier_3d.cpp:273-275) are the whole surface: no `_set`/`_get`,
 * `get_property_list`, `PropertyListHelper` or `ADD_ARRAY_COUNT`.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, v } from '../../../../linter/validators/index.js';

/**
 * RetargetModifier3D::TransformFlag (retarget_modifier_3d.h:41-43). TRANSFORM_FLAG_ALL (:44) is
 * absent on purpose: it is the OR of the three, not a fourth bit.
 */
const TRANSFORM_FLAGS: Record<number, string> = {
  1: 'TRANSFORM_FLAG_POSITION',
  2: 'TRANSFORM_FLAG_ROTATION',
  4: 'TRANSFORM_FLAG_SCALE',
};

validatorRegistry.registerAll('RetargetModifier3D', {
  // retarget_modifier_3d.cpp:273: Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE "SkeletonProfile".
  // The hint narrows the inspector's picker, not the .tscn grammar, and set_profile (:381-386)
  // takes any Ref with no guard, so only the reference's spelling is checkable.
  profile: v.resourceReference('profile'),
  // retarget_modifier_3d.cpp:274: Variant::BOOL, PROPERTY_HINT_NONE. set_use_global_pose (:392-401)
  // assigns unconditionally.
  use_global_pose: v.boolean('use_global_pose'),
  // retarget_modifier_3d.cpp:275: PROPERTY_HINT_FLAGS "Position,Rotation,Scale" offers bits 1, 2
  // and 4. set_enable_flags (:411) bare-assigns with no mask, so another bit loads and runs, only
  // unreachable from the inspector: the hint tier, not the setter tier (contrast `maskedBitField`).
  enable: hintedBitField('enable', {
    hinted: 'retarget_modifier_3d.cpp:275',
    labels: TRANSFORM_FLAGS,
  }),
});
