/**
 * `settings/<i>/<leaf>`: the flat half of the hand-rolled property family, keyed as
 * `_get_property_list` spells it. No leaf carries `radians_as_degrees`: the angle-adjacent floats
 * are lengths or coefficients behind a plain `PROPERTY_HINT_RANGE`, so hint numbers are stored
 * numbers.
 */

import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { BONE_DIRECTION, ROTATION_AXIS } from '../skeletonmodifier3d/linterParser.js';
import { nonZeroVector3 } from './nonZeroVector3.js';

/** PROPERTY_HINT_ENUM "WorldOrigin,Node,Bone" (spring_bone_simulator_3d.cpp:300). */
const CENTER_FROM: Record<number, string> = {
  0: 'WorldOrigin',
  1: 'Node',
  2: 'Bone',
};

/**
 * `settings/<i>/<leaf>`, keyed by the leaf path as `_get_property_list` spells it
 * (spring_bone_simulator_3d.cpp:293-339), so `end_bone/direction` and `radius/value` are ordinary
 * entries. The `PROPERTY_HINT_ENUM_SUGGESTION` bone names come from the skeleton (:286), which may
 * be absent, so each name leaf is a plain quoted string.
 */
export const SETTING_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // :293, Variant::STRING. set_root_bone_name (:440) assigns before resolving.
  root_bone_name: v.quotedString('root_bone_name'),

  // :294, Variant::INT, PROPERTY_HINT_NONE, PROPERTY_USAGE_NO_EDITOR, which is storage.
  // set_root_bone rewrites anything at or below -1 to -1 once a skeleton exists (:460-462), and
  // _validate_bone_names (:1355) re-runs it on the first skeleton update. The ceiling is the live
  // bone count, which no per-property rule sees.
  root_bone: v.strictInt('root_bone', { min: -1, enforced: 'spring_bone_simulator_3d.cpp:460-462' }),

  // :295, same shape as root_bone_name; set_end_bone_name is :477.
  end_bone_name: v.quotedString('end_bone_name'),

  // :296. set_end_bone applies the identical clamp to -1 (:497-499).
  end_bone: v.strictInt('end_bone', { min: -1, enforced: 'spring_bone_simulator_3d.cpp:497-499' }),

  // :297, Variant::BOOL. set_extend_end_bone (:515) assigns.
  extend_end_bone: v.boolean('extend_end_bone'),

  // :298, PROPERTY_HINT_ENUM over get_hint_bone_direction(), values 0-6 in the
  // BoneDirection declaration order (skeleton_modifier_3d.h:56-62).
  // set_end_bone_direction (:527) stores the static_cast unchecked, so the hint
  // governs the inspector only: warning.
  'end_bone/direction': v.enumInt('end_bone/direction', 0, 6, BONE_DIRECTION, {
    hinted: 'spring_bone_simulator_3d.cpp:298',
  }),

  // :299, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m". `or_greater`
  // opens the max end, so only the floor is reportable, and set_end_bone_length
  // (:544) assigns straight through: warning. No is_finite guard, so inf and nan
  // are values it keeps.
  'end_bone/length': v.float('end_bone/length', {
    min: 0,
    hinted: 'spring_bone_simulator_3d.cpp:299',
  }),

  // :300, PROPERTY_HINT_ENUM "WorldOrigin,Node,Bone". set_center_from (:576)
  // stores the static_cast unchecked: warning.
  center_from: v.enumInt('center_from', 0, 2, CENTER_FROM, {
    hinted: 'spring_bone_simulator_3d.cpp:300',
  }),

  // :301, Variant::NODE_PATH with no hint. set_center_node (:591) assigns.
  center_node: v.nodePath('center_node'),

  // :302, same shape as root_bone_name; set_center_bone_name is :605.
  center_bone_name: v.quotedString('center_bone_name'),

  // :303. Unbounded, unlike root_bone and end_bone: the clamp to -1 (:625-627) sits inside
  // `if (sk)` (:623), properties apply before parenting, and _validate_bone_names (:1355-1369)
  // never re-runs set_center_bone. An out-of-range index survives and re-serialises.
  center_bone: v.strictInt('center_bone'),

  // :304, Variant::BOOL. set_individual_config (:870) assigns. Which of the two
  // config blocks below is live depends on it, and that is linter.ts's.
  individual_config: v.boolean('individual_config'),

  // :305, PROPERTY_HINT_ENUM over get_hint_rotation_axis(), values 0-4
  // (skeleton_modifier_3d.h:81-85). set_rotation_axis (:793) assigns the
  // static_cast: warning.
  rotation_axis: v.enumInt('rotation_axis', 0, 4, ROTATION_AXIS, {
    hinted: 'spring_bone_simulator_3d.cpp:305',
  }),

  // :306, Variant::VECTOR3 with no hint. set_rotation_axis_vector (:808)
  // assigns any vector; a zero one is legal and reads as ROTATION_AXIS_ALL.
  rotation_axis_vector: v.vector3('rotation_axis_vector'),

  // :307, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m". Open ceiling, and
  // set_radius (:642) assigns straight through: warning on the floor only.
  'radius/value': v.float('radius/value', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:307' }),
  'radius/damping_curve': v.resourceReference('radius/damping_curve'),

  // :309, PROPERTY_HINT_RANGE "0,4,0.01,or_greater". set_stiffness (:676)
  // assigns straight through.
  'stiffness/value': v.float('stiffness/value', {
    min: 0,
    hinted: 'spring_bone_simulator_3d.cpp:309',
  }),
  'stiffness/damping_curve': v.resourceReference('stiffness/damping_curve'),

  // :311, PROPERTY_HINT_RANGE "0,1,0.01,or_greater". set_drag (:710) assigns
  // straight through.
  'drag/value': v.float('drag/value', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:311' }),
  'drag/damping_curve': v.resourceReference('drag/damping_curve'),

  // :313, PROPERTY_HINT_RANGE "0,1,0.01,or_greater,or_less,suffix:m/s". Both ends are open, so
  // there is no bound: gravity is a signed constant velocity, and a negative one is ordinary.
  // Format check only.
  'gravity/value': v.float('gravity/value'),
  'gravity/damping_curve': v.resourceReference('gravity/damping_curve'),

  // :315, Variant::VECTOR3, and the one leaf whose setter refuses a value.
  'gravity/direction': nonZeroVector3(
    'gravity/direction',
    'spring_bone_simulator_3d.cpp:780',
  ),

  // :316, Variant::INT with PROPERTY_USAGE_DEFAULT | PROPERTY_USAGE_ARRAY, so it
  // carries STORAGE (object.h). set_joint_count opens with
  // ERR_FAIL_COND(p_count < 0) (:1054), which refuses the write outright.
  joint_count: v.strictInt('joint_count', {
    min: 0,
    enforced: 'spring_bone_simulator_3d.cpp:1054',
  }),

  // :329, Variant::BOOL. set_enable_all_child_collisions (:1081) assigns. It selects which of the
  // two collision lists is live, which is linter.ts's.
  enable_all_child_collisions: v.boolean('enable_all_child_collisions'),

  // :330 and :335, both PROPERTY_HINT_NONE, and neither setter has the `ERR_FAIL_COND(p_count < 0)`
  // of setting_count (:841) and joint_count (:1054). But set_exclude_collision_count (:1123) and
  // set_collision_count (:1179) pass the value to `LocalVector<NodePath>::resize`, sized
  // `U = uint32_t` (local_vector.h:44, :188).
  exclude_collision_count: v.int('exclude_collision_count', {
    // A negative int wraps to about 4.29 billion and trips `CRASH_COND_MSG(!data, "Out of memory")`
    // (local_vector.h:179), and the disabled list's setter drops it instead. Nothing negative
    // round-trips.
    enforcedMin: { at: 0 },
    enforced: { min: 'local_vector.h:179' },
  }),
  collision_count: v.int('collision_count', {
    enforcedMin: { at: 0 },
    enforced: { min: 'local_vector.h:179' },
  }),
};
