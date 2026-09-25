/**
 * `setting_count`, the array count eight SkeletonModifier3D subclasses each declare through their
 * own `ADD_ARRAY_COUNT` (a serialised INT with PROPERTY_HINT_NONE, class_db.cpp:1492, so no
 * ceiling). Every setter behind it takes `int p_count` and reaches one of four guard sites that
 * open with `ERR_FAIL_COND(p_count < 0)`, so one reading of the slot serves all eight.
 */

import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

/** The four guard sites that refuse a negative count, by the class that defines each. */
const NEGATIVE_COUNT_GUARD = {
  BoneConstraint3D: 'bone_constraint_3d.cpp:131',
  BoneTwistDisperser3D: 'bone_twist_disperser_3d.cpp:650',
  // The `_set_setting_count<T>` template (ik_modifier_3d.h:97-98). Each subclass override forwards
  // to it with no guard of its own: iterate_ik_3d.h:287, spline_ik_3d.h:163, two_bone_ik_3d.h:267.
  IKModifier3D: 'ik_modifier_3d.h:98',
  SpringBoneSimulator3D: 'spring_bone_simulator_3d.cpp:841',
} as const;

/** The class that defines the guard site a `setting_count` setter reaches. */
export type SettingCountGuard = keyof typeof NEGATIVE_COUNT_GUARD;

/**
 * The `setting_count` validator for a class whose setter reaches `guard`'s site. An int32 slot:
 * `int p_count` in bone_constraint_3d.h:98, bone_twist_disperser_3d.h:116, ik_modifier_3d.h:97 and
 * spring_bone_simulator_3d.h:263, so `2147483648` arrives as a negative count and is refused.
 */
export function settingCount(guard: SettingCountGuard): PropertyValidator {
  return v.int('setting_count', { min: 0, width: 'int32', enforced: NEGATIVE_COUNT_GUARD[guard] });
}
