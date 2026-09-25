/**
 * `setting_count`, the array count eight SkeletonModifier3D subclasses each declare through their
 * own `ADD_ARRAY_COUNT` (a serialised INT with PROPERTY_HINT_NONE, class_db.cpp:1492, so no
 * ceiling). The four setters behind it share one signature, `set_setting_count(int p_count)`, and
 * each opens with `ERR_FAIL_COND(p_count < 0)`, so one reading of the slot serves all eight.
 */

import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

/** Where each `set_setting_count` refuses a negative count, by the class that defines it. */
const NEGATIVE_COUNT_GUARD = {
  BoneConstraint3D: 'bone_constraint_3d.cpp:131',
  BoneTwistDisperser3D: 'bone_twist_disperser_3d.cpp:650',
  // The `_set_setting_count<T>` template, which every IKModifier3D subclass's override calls.
  IKModifier3D: 'ik_modifier_3d.h:98',
  SpringBoneSimulator3D: 'spring_bone_simulator_3d.cpp:841',
} as const;

/** A class whose `set_setting_count` a `setting_count` key reaches. */
export type SettingCountSetter = keyof typeof NEGATIVE_COUNT_GUARD;

/**
 * The `setting_count` validator for a class whose setter is `setter`'s. An int32 slot: `int
 * p_count` in bone_constraint_3d.h:98, bone_twist_disperser_3d.h:116, ik_modifier_3d.h:97 and
 * spring_bone_simulator_3d.h:263, so `2147483648` arrives as a negative count and is refused.
 */
export function settingCount(setter: SettingCountSetter): PropertyValidator {
  return v.int('setting_count', { min: 0, width: 'int32', enforced: NEGATIVE_COUNT_GUARD[setter] });
}
