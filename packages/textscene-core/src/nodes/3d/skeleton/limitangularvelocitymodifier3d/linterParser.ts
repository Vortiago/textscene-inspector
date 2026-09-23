/**
 * LimitAngularVelocityModifier3D strict validators: the doc/classes/LimitAngularVelocityModifier3D.xml
 * members without `overrides=`, not `active`/`influence` (skeleton_modifier_3d.cpp:161). Beside the
 * macros (limit_angular_velocity_modifier_3d.cpp:247), `_set` (:33), `_get` (:56) and `_get_property_list`
 * (:90) build `chains/<i>/` (:98) and `joints/<i>/` (:106). No `PropertyListHelper` or `register_property`.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import { RADIAN_ROUNDTRIP_EPSILON } from '../../../../linter/validators/v.js';

/**
 * The four `chains/<i>/` leaves, keyed exactly as `_get_property_list` spells
 * them (limit_angular_velocity_modifier_3d.cpp:99-102). All four are one
 * segment deep, which is what lets the family register under the glued-index
 * `chains/#/*` wildcard rather than the plain prefix form.
 */
const CHAIN_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // limit_angular_velocity_modifier_3d.cpp:99, STRING with PROPERTY_HINT_ENUM_SUGGESTION over the
  // bone names (:94), a suggestion, not a constraint. set_root_bone_name (:129) stores whatever it is
  // handed before resolving it, so only the literal's shape is checkable.
  root_bone_name: v.quotedString('root_bone_name'),

  // limit_angular_velocity_modifier_3d.cpp:100, INT, PROPERTY_HINT_NONE, PROPERTY_USAGE_NO_EDITOR,
  // which is storage (object.h:132). set_root_bone rewrites anything below -1 to the unset -1
  // (:149-151), and _validate_bone_names (:293-295) re-runs it on the first skeleton update: an error
  // (ADR-0032). The live bone count is the ceiling. `strictInt`: Variant would truncate a decimal.
  root_bone: v.strictInt('root_bone', {
    min: -1,
    enforced: 'limit_angular_velocity_modifier_3d.cpp:149-151',
  }),

  // limit_angular_velocity_modifier_3d.cpp:101, the same hint and the same
  // non-constraint as root_bone_name. set_end_bone_name is :166.
  end_bone_name: v.quotedString('end_bone_name'),

  // limit_angular_velocity_modifier_3d.cpp:102. set_end_bone (:186-188) applies
  // the identical rewrite to -1, re-run from _validate_bone_names (:299-300).
  end_bone: v.strictInt('end_bone', {
    min: -1,
    enforced: 'limit_angular_velocity_modifier_3d.cpp:186-188',
  }),
};

/**
 * The `chains/<i>/` dispatcher, with a closed leaf set: the class is concrete
 * (register_scene_types.cpp:687) and nothing derives from it, and `_set` returns false for any other
 * `what` (:49-50), which drops the write.
 */
const chainsFamily = indexedFamilyValidator({
  prefix: 'chains/',
  leaves: CHAIN_LEAVES,
  unknownCode: 'INVALID_LIMIT_ANGULAR_VELOCITY_CHAIN',
  describes: 'LimitAngularVelocityModifier3D chain',
  // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()`
  // (:37) and gates on nothing, so a non-numeric index resolves to some chain
  // and the write lands. Nothing refuses it, so nothing is reported.
  indexParse: 'to_int',
  negativeIndex: {
    // `ERR_FAIL_INDEX_V(which, (int)chains.size(), false)` in `_set`, which
    // fires on a negative index before any leaf is looked at, so the write is
    // dropped rather than applied.
    cite: 'limit_angular_velocity_modifier_3d.cpp:39',
    code: 'INVALID_LIMIT_ANGULAR_VELOCITY_CHAIN_INDEX',
    message: (index) =>
      `Chain index ${index} is out of range: LimitAngularVelocityModifier3D's _set refuses a negative index (limit_angular_velocity_modifier_3d.cpp:39) and the write is dropped`,
  },
});

/**
 * The joint list is derived, never written: `_update_joints` (limit_angular_velocity_modifier_3d.cpp:324)
 * rebuilds it, and neither PropertyInfo has PROPERTY_USAGE_STORAGE (object.h:101): EDITOR | READ_ONLY
 * for `bone_name` (:107), a bare READ_ONLY (object.h:128) for `bone` (:108). The whole `joints/#/*`
 * space is registered, since any leaf under it meets the same fall-through.
 */
const jointReadOnly = v.readOnly('joints', {
  derivedFrom: "LimitAngularVelocityModifier3D's per-chain root_bone and end_bone",
  // `_set` (:33) has only a `chains/` branch (:36), so a `joints/` write falls to `return true` (:53)
  // having assigned nothing: valid to `Object::set`, unlike ChainIK3D's `false`, but stored nowhere,
  // which is ADR-0032's error row.
  cite: 'limit_angular_velocity_modifier_3d.cpp:36-53',
  code: 'INVALID_JOINTS_READONLY',
});

// `joint_count` (:275) gets no validator: its `ADD_ARRAY_COUNT` names no setter, and `add_property`
// binds one only when named (class_db.cpp:1512). `_get_joint_count` (:227) returns the list
// `_update_joints` (:324) rebuilds, and `_validate_property` (:112-117) marks it READ_ONLY. It still
// carries STORAGE (class_db.h:475, object.h:131), so a saved scene may hold it.
validatorRegistry.registerAll('LimitAngularVelocityModifier3D', {
  // limit_angular_velocity_modifier_3d.cpp:272, "0,720,or_greater,radians_as_degrees,suffix:°/s": the
  // hint is in degrees, the `.tscn` in radians, and `or_greater` opens the max end, so the floor is 0
  // radians, widened by the shared epsilon for a float32 zero that reloads a hair negative.
  // set_max_angular_velocity (:231-233) assigns with no clamp or is_finite guard: a warning.
  max_angular_velocity: v.float('max_angular_velocity', {
    // Not `v.radians`, which needs a `maxDeg` and would close the ceiling at 4 * PI, rejecting the
    // 20 rad/s the open-ended spinner produces. The epsilon is imported, so this floor and every
    // `v.radians` one move together.
    min: -RADIAN_ROUNDTRIP_EPSILON,
    hinted: 'limit_angular_velocity_modifier_3d.cpp:272',
  }),

  // limit_angular_velocity_modifier_3d.cpp:273, Variant::BOOL with no hint.
  // set_exclude (:239-241) assigns, so only the literal's format is checkable.
  exclude: v.boolean('exclude'),

  // limit_angular_velocity_modifier_3d.cpp:274, the `chains/` ADD_ARRAY_COUNT, a serialised INT
  // (class_db.cpp:1492). set_chain_count opens with ERR_FAIL_COND(p_count < 0) (:204): an error. The
  // max end is open, as `chains.resize(p_count)` (:205) has no ceiling.
  chain_count: v.strictInt('chain_count', {
    min: 0,
    enforced: 'limit_angular_velocity_modifier_3d.cpp:204',
  }),

  'chains/#/*': chainsFamily,
  'joints/#/*': jointReadOnly,
});
