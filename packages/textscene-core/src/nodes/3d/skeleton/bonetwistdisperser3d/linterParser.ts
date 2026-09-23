/**
 * BoneTwistDisperser3D strict validators: only its own members, as the base-walk delivers `active` and
 * `influence`. doc/classes/BoneTwistDisperser3D.xml lists two, and a hand-rolled `_set`
 * (bone_twist_disperser_3d.cpp:33), `_get` (:80) and `_get_property_list` (:133) serialise a whole
 * `settings/<i>/…` family. No `PropertyListHelper` or `register_property` exists.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { accepts, keyShapeError, v } from '../../../../linter/validators/index.js';
import { BONE_DIRECTION } from '../skeletonmodifier3d/linterParser.js';
import { indexedKeyRegex, toIntIndex } from '../../../../godot/index.js';

/**
 * `BoneTwistDisperser3D::DisperseMode`, bone_twist_disperser_3d.h:41-45, in the
 * order of the inline hint string `"Even,Weighted,Custom"`
 * (bone_twist_disperser_3d.cpp:154).
 */
const DISPERSE_MODE: Record<number, string> = {
  0: 'Even',
  1: 'Weighted',
  2: 'Custom',
};

/** Error code for a `settings/…` key whose shape or leaf name is unrecognised. */
const UNKNOWN_SETTING_CODE = 'INVALID_SETTING_KEY';
/** Error code for a `settings/…` key addressing a negative setting. */
const NEGATIVE_SETTING_INDEX_CODE = 'INVALID_SETTING_INDEX';
/** Error code for a `settings/<i>/joints/…` key addressing a negative joint. */
const NEGATIVE_JOINT_INDEX_CODE = 'INVALID_JOINT_INDEX';

function negativeSettingMessage(index: number): string {
  return (
    `Setting index ${index} must be non-negative. BoneTwistDisperser3D::_set opens with ` +
    'ERR_FAIL_INDEX_V(which, settings.size(), false) (bone_twist_disperser_3d.cpp:39), so ' +
    'the write is refused and never reaches a setter'
  );
}

function negativeJointMessage(index: number): string {
  return (
    `Joint index ${index} must be non-negative. set_joint_twist_amount guards with ` +
    'ERR_FAIL_INDEX(p_joint, joints.size()) (bone_twist_disperser_3d.cpp:502), so the ' +
    'write is refused'
  );
}

/**
 * The single-segment `settings/<i>/<leaf>` leaves, in `_get_property_list` order
 * (bone_twist_disperser_3d.cpp:144-158). None is an angle: the only range hints are :155 and :163,
 * with no `radians_as_degrees`, and the twist is computed at runtime (`get_roll_angle`, :773).
 */
const SETTING_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // :144, Variant::STRING, PROPERTY_HINT_ENUM_SUGGESTION over the skeleton's
  // bone names: a dropdown that still accepts free text, so it constrains
  // nothing. set_root_bone_name (:246-253) assigns and then resolves the name.
  root_bone_name: v.quotedString('root_bone_name'),

  // :145, INT, PROPERTY_HINT_NONE, PROPERTY_USAGE_NO_EDITOR (with STORAGE). set_root_bone rewrites
  // anything at or below -1, or past the live bone count, to -1 (:266-268), and _validate_bone_names
  // re-runs it on the first skeleton update (:573-574), so only the floor is assertable. `strictInt`:
  // a bone index is discrete, and Variant conversion would truncate a decimal.
  root_bone: v.strictInt('root_bone', { min: -1, enforced: 'bone_twist_disperser_3d.cpp:266-268' }),

  // :146, as root_bone_name. set_end_bone_name is :283-290.
  end_bone_name: v.quotedString('end_bone_name'),

  // :147, as root_bone. set_end_bone applies the identical rewrite (:303-305),
  // re-run from _validate_bone_names (:579-580).
  end_bone: v.strictInt('end_bone', { min: -1, enforced: 'bone_twist_disperser_3d.cpp:303-305' }),

  // :148, Variant::BOOL, no hint. set_extend_end_bone (:321-326) assigns.
  extend_end_bone: v.boolean('extend_end_bone'),

  // :149, PROPERTY_HINT_ENUM over SkeletonModifier3D::get_hint_bone_direction()
  // "+X,-X,+Y,-Y,+Z,-Z,FromParent" (skeleton_modifier_3d.h:64), values 0-6.
  // set_end_bone_direction (:333-336) stores the static_cast unchecked, so the
  // hint governs the inspector dropdown only: out of range is a warning.
  end_bone_direction: v.enumInt('end_bone_direction', 0, 6, BONE_DIRECTION, {
    hinted: 'bone_twist_disperser_3d.cpp:149',
  }),

  // bone_twist_disperser_3d.cpp:151, PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_READ_ONLY, so no STORAGE and
  // the packer never writes it. _update_reference_bone (:364-387) derives it
  // from end_bone and extend_end_bone, and _set falls through to `return false`
  // (:74) for the key.
  reference_bone_name: v.readOnly('reference_bone_name', {
    derivedFrom: "BoneTwistDisperser3D's end_bone and extend_end_bone",
    cite: 'bone_twist_disperser_3d.cpp:74',
    code: 'INVALID_SETTING_READONLY',
  }),

  // :152, Variant::BOOL, no hint. set_twist_from_rest (:343-347) assigns.
  twist_from_rest: v.boolean('twist_from_rest'),

  // :153, Variant::QUATERNION, no hint. set_twist_from (:354-357) assigns. The
  // normalisation happens at process time (:770), not in the setter, so an
  // unnormalised quaternion is stored exactly as written.
  twist_from: v.quaternion('twist_from'),

  // :154, PROPERTY_HINT_ENUM "Even,Weighted,Custom", values 0-2.
  // set_disperse_mode (:411-415) stores the static_cast unchecked: warning.
  disperse_mode: v.enumInt('disperse_mode', 0, 2, DISPERSE_MODE, {
    hinted: 'bone_twist_disperser_3d.cpp:154',
  }),

  // :155, Variant::FLOAT, PROPERTY_HINT_RANGE "0,1,0.001", both ends closed. set_weight_position
  // (:422-425) assigns with no clamp and no is_finite guard, so a value outside 0-1 loads and is
  // only outside the inspector slider: hinted, a warning at both ends.
  weight_position: v.float('weight_position', {
    min: 0,
    max: 1,
    hinted: 'bone_twist_disperser_3d.cpp:155',
  }),

  // :156, Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE "Curve". No leaf is in ClassDB, so
  // `get_property_default_value` finds no default (property_utils.cpp:182-198) and `_parse_node`
  // (packed_scene.cpp:982) writes every live leaf, `damping_curve = null` included.
  damping_curve: v.resourceReference('damping_curve'),

  // :158, Variant::INT with PROPERTY_USAGE_DEFAULT | PROPERTY_USAGE_ARRAY (so
  // it carries STORAGE): the count of the nested joints array. set_joint_count
  // opens with ERR_FAIL_COND(p_count < 0) (:487), which refuses the write
  // outright. There is no ceiling anywhere.
  joint_count: v.strictInt('joint_count', { min: 0, enforced: 'bone_twist_disperser_3d.cpp:487' }),
};

/**
 * The nested `settings/<i>/joints/<j>/<leaf>` family
 * (bone_twist_disperser_3d.cpp:159-164), routed by `_set`'s inner `prop` switch
 * (:65-72).
 */
const JOINT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // :161, PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_READ_ONLY (no STORAGE), so the packer skips it
  // (packed_scene.cpp:865). _update_joints (:600-643) rebuilds the list from the skeleton, and _set's
  // joints branch accepts only twist_amount (:71), so a hand-written value is dropped.
  bone_name: v.readOnly('bone_name', {
    derivedFrom: "BoneTwistDisperser3D's bone chain between root_bone and end_bone",
    cite: 'bone_twist_disperser_3d.cpp:71',
    code: 'INVALID_SETTING_READONLY',
  }),

  // :162, a bare PROPERTY_USAGE_READ_ONLY usage, which replaces
  // PROPERTY_USAGE_DEFAULT outright and so carries no STORAGE either.
  bone: v.readOnly('bone', {
    derivedFrom: "BoneTwistDisperser3D's bone chain between root_bone and end_bone",
    cite: 'bone_twist_disperser_3d.cpp:71',
    code: 'INVALID_SETTING_READONLY',
  }),

  // :163, Variant::FLOAT, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,or_less".
  // `or_greater` opens the max end and `or_less` opens the min end, so the hint
  // states no reportable bound (ADR-0032), and set_joint_twist_amount
  // (:499-504) assigns with no clamp and no is_finite guard: format only.
  twist_amount: v.float('twist_amount'),
};

/** Every `settings/<i>/<leaf>` key whose leaf is a single segment. */
const flatFamily = indexedFamilyValidator({
  // `_set` reads the index with a bare `to_int` and no `is_valid_int` gate (bone_twist_disperser_3d.cpp:37),
  // and `_to_int` skips non-digits (ustring.cpp:2268-2298), so `settings/x/root_bone` lands on setting
  // 0. Gating is PropertyListHelper's behaviour, not this class's.
  indexParse: 'to_int',
  prefix: 'settings/',
  leaves: SETTING_LEAVES,
  unknownCode: UNKNOWN_SETTING_CODE,
  describes: 'setting',
  negativeIndex: {
    cite: 'bone_twist_disperser_3d.cpp:39',
    code: NEGATIVE_SETTING_INDEX_CODE,
    message: negativeSettingMessage,
  },
});

/**
 * `settings/<i>/joints/<j>/<leaf>`. Both indices parse under `to_int`, as `_set` reads the joint index
 * with a bare `to_int` too (:66). Demanding digits would send `settings/0/joints/x/twist_amount` to
 * `flatFamily` as an unknown leaf. The leaf is one segment, since `_set` reads a fixed
 * `get_slicec('/', 4)` (:67), so `settings/0/joints/0/twist_amount/extra` reaches the setter too.
 */
const JOINT_KEY_RE = indexedKeyRegex('^settings/(#)/joints/(#)/([^/]+)(?:/.*)?$', 'to_int');

/**
 * The negative-index error for an index `to_int` resolves below zero, read as `_set` reads it
 * (:37, :66): `a-1` is -1 (ustring.cpp:2291-2292), and the `ERR_FAIL_INDEX_V` beside each parse
 * refuses it. A NaN index, a spelling neither reader can name, fails the comparison and passes.
 */
function negativeIndexError(
  indexText: string,
  key: string,
  line: number,
  message: (index: number) => string,
  code: string
) {
  const index = toIntIndex(indexText);
  if (index < 0) return keyShapeError(key, line, message(index), code);
  return null;
}

/**
 * The whole `settings/` family. The nested `joints/<j>/<leaf>` shape is handled here, and everything
 * else goes to `flatFamily`, which owns the index parse, the negative-index refusal and the
 * unknown-leaf message for the common shape.
 */
const settingValidator = accepts((key, value, line) => {
  const match = JOINT_KEY_RE.exec(key);
  if (!match) return flatFamily(key, value, line);

  const unknown = () =>
    keyShapeError(key, line, `Unknown setting property: "${key}"`, UNKNOWN_SETTING_CODE);

  const negativeSetting = negativeIndexError(
    match[1] ?? '',
    key,
    line,
    negativeSettingMessage,
    NEGATIVE_SETTING_INDEX_CODE
  );
  if (negativeSetting) return negativeSetting;

  const negativeJoint = negativeIndexError(
    match[2] ?? '',
    key,
    line,
    negativeJointMessage,
    NEGATIVE_JOINT_INDEX_CODE
  );
  if (negativeJoint) return negativeJoint;

  // hasOwnProperty, so a leaf named `toString` cannot resolve an inherited
  // function and get called as a validator.
  const leafName = match[3] ?? '';
  if (!Object.prototype.hasOwnProperty.call(JOINT_LEAVES, leafName)) return unknown();
  const leaf = JOINT_LEAVES[leafName];
  return leaf ? leaf(key, value, line) : unknown();
}, 'settings/<i>/<leaf> and settings/<i>/joints/<j>/<leaf>');

// A negative setting index is refused by the class's own ERR_FAIL_INDEX_V, so
// this dispatcher rejects a real value and is grounded rather than format-only.
// The leaves are exposed so `boundGrounding`'s sweep recurses past the
// dispatcher instead of taking its tag as a vouch for every bound behind it.
settingValidator.grounding = { kind: 'enforced', cite: 'bone_twist_disperser_3d.cpp:39' };
settingValidator.leaves = [flatFamily, ...Object.values(JOINT_LEAVES)];

validatorRegistry.registerAll('BoneTwistDisperser3D', {
  // bone_twist_disperser_3d.cpp:560, a bare PropertyInfo(Variant::BOOL, …) with
  // no hint. set_mutable_bone_axes (:238-240) is a plain assignment, refusing
  // and altering nothing, so format is the only constraint.
  mutable_bone_axes: v.boolean('mutable_bone_axes'),

  // bone_twist_disperser_3d.cpp:561, ADD_ARRAY_COUNT: a serialised INT through `add_property` with
  // `PROPERTY_USAGE_DEFAULT | PROPERTY_USAGE_ARRAY` (class_db.cpp:1492, class_db.h:475), no hint.
  // set_setting_count opens with ERR_FAIL_COND(p_count < 0) (:650), so the floor is enforced. There
  // is no ceiling.
  setting_count: v.strictInt('setting_count', {
    min: 0,
    enforced: 'bone_twist_disperser_3d.cpp:650',
  }),

  // The plain wildcard, not `settings/#/*`: `matchesIndexedKey` routes a single leaf segment, so
  // it would never deliver `settings/0/joints/0/twist_amount`.
  'settings/*': settingValidator,
});
