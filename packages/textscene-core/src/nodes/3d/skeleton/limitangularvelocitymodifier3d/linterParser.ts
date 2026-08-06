/**
 * LimitAngularVelocityModifier3D strict validators for linting.
 *
 * Declare only LimitAngularVelocityModifier3D's OWN members, the ones
 * doc/classes/LimitAngularVelocityModifier3D.xml lists without an `overrides=`
 * attribute. Everything from SkeletonModifier3D up is registered on the
 * ancestor and delivered by the NODE_BASE_TYPES base-walk, so re-declaring an
 * inherited key shadows it and duplicates the rule. `active` and `influence`
 * are SkeletonModifier3D's (skeleton_modifier_3d.cpp:161) and are not repeated
 * here.
 *
 * ## Three of the four routes into a `.tscn`, and which fourth is absent
 *
 * `_bind_methods` (limit_angular_velocity_modifier_3d.cpp:247) uses two of
 * them: `ADD_PROPERTY` for `max_angular_velocity` (:272) and `exclude` (:273),
 * and `ADD_ARRAY_COUNT` for `chain_count` (:274) and `joint_count` (:275). The
 * third is a hand-rolled property list: `_set` (:33), `_get` (:56) and
 * `_get_property_list` (:90) build `chains/<i>/` (:98) and `joints/<i>/` (:106)
 * by string concatenation, so neither family appears in any `ADD_*` call and a
 * grep for the macros alone reports the class's surface as four keys instead of
 * eight. The fourth route is genuinely unused: `PropertyListHelper` and
 * `register_property` both return zero hits across the `.cpp` and the `.h`.
 *
 * ## No radian conversion is in force anywhere in this file
 *
 * `max_angular_velocity` IS a `radians_as_degrees` property, so the hint's
 * numbers are DEGREES while the `.tscn` stores RADIANS. It still ends up with
 * no converted bound, and that is a conclusion rather than an oversight: the
 * hint reads `"0,720,or_greater,radians_as_degrees,suffix:°/s"` (:272, whose
 * suffix is concatenated from `String(U"°") + "/s"` rather than written flat)
 * and `or_greater` OPENS the max end, which leaves the floor as the only
 * reportable bound, and 0 degrees is 0 radians in either unit.
 *
 * `v.radians` is therefore deliberately not used. It requires a `maxDeg` and
 * closes the ceiling at `maxDeg * PI / 180`, which here is 720 degrees =
 * 12.566371 radians (4 * PI), so it would reject the 20 rad/s that the
 * inspector's own open-ended spinner produces. Bounding on the raw hint number
 * instead (`max: 720`) is the other way to get this wrong, and is worse: 720
 * RADIANS is 41253 degrees per second, so it would accept anything a scene
 * could plausibly contain while rejecting nothing. linterParser.test.ts pins
 * both failure modes with explicit accept cases at 12.566371, 12.6 and 800.
 *
 * ## `joint_count` is getter-only, so it gets no validator
 *
 * Its `ADD_ARRAY_COUNT` (:275) passes an EMPTY setter name, and `add_property`
 * resolves a setter MethodBind only when one is given (class_db.cpp:1512), so
 * the key has a getter and nothing to write through. `_get_joint_count` (:227)
 * returns the length of a list that `_update_joints` (:324) rebuilds from the
 * chains, and `_validate_property` (:112-117) marks the key READ_ONLY. The
 * count does carry STORAGE, since `ADD_ARRAY_COUNT` defaults `p_count_usage` to
 * `PROPERTY_USAGE_DEFAULT` (class_db.h:475) which is STORAGE | EDITOR
 * (object.h:131), so a saved scene may well contain the key; there is simply no
 * value of it that Godot would refuse, because it never reads one back.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';

/**
 * The four `chains/<i>/` leaves, keyed exactly as `_get_property_list` spells
 * them (limit_angular_velocity_modifier_3d.cpp:99-102). All four are one
 * segment deep, which is what lets the family register under the glued-index
 * `chains/#/*` wildcard rather than the plain prefix form.
 */
const CHAIN_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // limit_angular_velocity_modifier_3d.cpp:99, Variant::STRING with
  // PROPERTY_HINT_ENUM_SUGGESTION over the skeleton's concatenated bone names
  // (:94). A suggestion list is not a constraint, and set_root_bone_name (:129)
  // stores whatever String it is handed before trying to resolve it, so only
  // the literal's shape is checkable.
  root_bone_name: v.quotedString('root_bone_name'),

  // limit_angular_velocity_modifier_3d.cpp:100, Variant::INT, PROPERTY_HINT_NONE,
  // PROPERTY_USAGE_NO_EDITOR, which IS storage (object.h:132). -1 is the unset
  // sentinel the setter writes itself. Anything BELOW -1 is rewritten to -1 by
  // set_root_bone (:149-151) once a skeleton is present; get_skeleton() may
  // still be null at load, but _validate_bone_names (:293-295) re-runs the same
  // setter on the first skeleton update, so a value under -1 cannot survive as
  // written. The setter ALTERS it, which is ADR-0032's error tier. The upper
  // bound is the live bone count, which no per-property validator can see.
  // `strictInt`, since a bone index is discrete and Godot's Variant conversion
  // would truncate a decimal rather than keep it.
  root_bone: v.strictInt('root_bone', {
    min: -1,
    enforced: 'limit_angular_velocity_modifier_3d.cpp:149-151',
  }),

  // limit_angular_velocity_modifier_3d.cpp:101, the same hint and the same
  // non-constraint as root_bone_name; set_end_bone_name is :166.
  end_bone_name: v.quotedString('end_bone_name'),

  // limit_angular_velocity_modifier_3d.cpp:102. set_end_bone (:186-188) applies
  // the identical rewrite to -1, re-run from _validate_bone_names (:299-300).
  end_bone: v.strictInt('end_bone', {
    min: -1,
    enforced: 'limit_angular_velocity_modifier_3d.cpp:186-188',
  }),
};

/**
 * The `chains/<i>/` dispatcher.
 *
 * The leaf set is CLOSED, unlike the `settings/` families further along this
 * shelf: `LimitAngularVelocityModifier3D` is registered as a concrete class
 * (register_scene_types.cpp:687) and nothing in the engine derives from it, so
 * no subclass can add a fifth leaf. `_set` agrees, returning false for any
 * `what` outside the four (:49-50), which drops the write.
 */
const chainsFamily = indexedFamilyValidator({
  prefix: 'chains/',
  leaves: CHAIN_LEAVES,
  unknownCode: 'INVALID_LIMIT_ANGULAR_VELOCITY_CHAIN',
  describes: 'LimitAngularVelocityModifier3D chain',
  // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()`
  // (:37) and gates on nothing, so a non-numeric index resolves to SOME chain
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
 * The joint list is DERIVED, never written.
 *
 * `_update_joints` (limit_angular_velocity_modifier_3d.cpp:324) rebuilds it by
 * walking each chain from its end bone up to its root bone, and the two
 * PropertyInfos `_get_property_list` emits for it carry no STORAGE flag:
 * `PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_READ_ONLY` for `bone_name` (:107) and
 * a bare `PROPERTY_USAGE_READ_ONLY` for `bone` (:108). READ_ONLY is a bit of
 * its own (object.h:128) and neither combination includes
 * PROPERTY_USAGE_STORAGE (object.h:101), so Godot never writes either key.
 *
 * A hand-written one is discarded. `_set` (:33) has a `chains/` branch (:36)
 * and no other, so a `joints/` path falls straight through to `return true`
 * (:53) having assigned nothing. That `true` is the single difference from the
 * same construct on ChainIK3D, which returns false: `Object::set` reports the
 * write valid instead of invalid. The value is still stored nowhere, and
 * ADR-0032's error row is what a write the setter does not apply is.
 *
 * Registered across the whole `joints/#/*` space rather than on the two leaf
 * names, because an unrecognised leaf under the same prefix meets the identical
 * fall-through and deserves the identical verdict.
 */
const jointReadOnly = v.readOnly('joints', {
  derivedFrom: "LimitAngularVelocityModifier3D's per-chain root_bone and end_bone",
  cite: 'limit_angular_velocity_modifier_3d.cpp:36-53',
  code: 'INVALID_JOINTS_READONLY',
});

validatorRegistry.registerAll('LimitAngularVelocityModifier3D', {
  // limit_angular_velocity_modifier_3d.cpp:272, PROPERTY_HINT_RANGE
  // "0,720,or_greater,radians_as_degrees,suffix:°/s". The stored unit is
  // RADIANS and the hint's numbers are DEGREES, but `or_greater` opens the max
  // end, so the ceiling is unreportable and the floor converts to itself:
  // 0 degrees = 0 radians. set_max_angular_velocity (:231-233) is a bare
  // assignment with no clamp, so the hint governs the inspector spinner alone
  // and a value below the floor is a WARNING (ADR-0032). No
  // ERR_FAIL_COND(!is_finite(...)) anywhere in that setter, so `inf` and `nan`
  // are values it keeps; only `-inf` trips the floor, exactly as -0.01 does.
  max_angular_velocity: v.float('max_angular_velocity', {
    min: 0,
    hinted: 'limit_angular_velocity_modifier_3d.cpp:272',
  }),

  // limit_angular_velocity_modifier_3d.cpp:273, Variant::BOOL with no hint.
  // set_exclude (:239-241) assigns, so only the literal's format is checkable.
  exclude: v.boolean('exclude'),

  // limit_angular_velocity_modifier_3d.cpp:274, the `chains/` array counter.
  // ADD_ARRAY_COUNT declares a real serialised INT (class_db.cpp:1492), and
  // set_chain_count opens with ERR_FAIL_COND(p_count < 0) (:204), which refuses
  // the write outright: error, not warning. The max end is open, since the
  // following `chains.resize(p_count)` (:205) has no ceiling of its own.
  chain_count: v.strictInt('chain_count', {
    min: 0,
    enforced: 'limit_angular_velocity_modifier_3d.cpp:204',
  }),

  'chains/#/*': chainsFamily,
  'joints/#/*': jointReadOnly,
});
