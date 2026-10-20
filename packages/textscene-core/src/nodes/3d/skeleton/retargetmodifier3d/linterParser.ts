/**
 * RetargetModifier3D validators: its own members only, the ones doc/classes/RetargetModifier3D.xml
 * lists without `overrides=`, since the base-walk delivers SkeletonModifier3D's. Three
 * `ADD_PROPERTY` calls (retarget_modifier_3d.cpp:273-275) are the whole surface: no `_set`/`_get`,
 * `get_property_list`, `PropertyListHelper` or `ADD_ARRAY_COUNT`.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, v } from '../../../../linter/validators/index.js';
import { RETARGET_TRANSFORM_FLAG_NAMES } from '../../../../godot/scene/skeletonModifier.js';

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
    labels: RETARGET_TRANSFORM_FLAG_NAMES,
  }),
});
