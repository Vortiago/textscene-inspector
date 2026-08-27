/**
 * BoneTwistDisperser3D strict validators for linting.
 *
 * Declare only BoneTwistDisperser3D's OWN members. Everything from
 * SkeletonModifier3D up is registered on the ancestor and delivered by the
 * NODE_BASE_TYPES base-walk, so re-declaring an inherited key shadows it and
 * duplicates the rule: `active` and `influence` are deliberately absent here.
 *
 * ## Three keys, thirteen leaves, and three routes into the file
 *
 * doc/classes/BoneTwistDisperser3D.xml lists two members, `mutable_bone_axes`
 * and `setting_count`, and the class serialises a whole `settings/<i>/…` family
 * that appears in no `ADD_PROPERTY`. The three routes it uses:
 *
 * - `ADD_PROPERTY` (bone_twist_disperser_3d.cpp:560) for `mutable_bone_axes`.
 * - `ADD_ARRAY_COUNT` (:561) for `setting_count`, which is a real serialised
 *   INT: the macro forwards to `add_property` with `PROPERTY_USAGE_DEFAULT |
 *   PROPERTY_USAGE_ARRAY` (class_db.cpp:1492, class_db.h:475).
 * - A hand-rolled `_set` (bone_twist_disperser_3d.cpp:33) / `_get` (:80) /
 *   `_get_property_list` (:133) triple. None of the three is grep-visible as an
 *   `ADD_PROPERTY`, and reading the XML alone would leave 13 leaves unvalidated.
 *
 * There is no `PropertyListHelper` and no `register_property` anywhere in the
 * class, which is the fourth route ruled out.
 *
 * ## No radians, despite the name
 *
 * `_get_property_list` emits exactly two `PROPERTY_HINT_RANGE` hints, `"0,1,
 * 0.001"` (:155) and `"0,1,0.001,or_greater,or_less"` (:163), and no
 * `radians_as_degrees` appears anywhere in the class. The twist this node
 * disperses is computed at runtime from the bone poses (`get_roll_angle`, :773)
 * and never serialised, so there is no degree/radian conversion to pin.
 *
 * ## One plain `settings/*` wildcard, not the glued-index `settings/#/*`
 *
 * `ValidatorRegistry.matchesIndexedKey` routes a SINGLE leaf segment, so the
 * glued form would never deliver `settings/0/joints/0/twist_amount` and every
 * value on it would be silently accepted. The family registers under the plain
 * prefix instead, and the index parse happens in the dispatcher below.
 *
 * ## What Godot writes, and what it refuses
 *
 * Three of the PropertyInfos carry no `PROPERTY_USAGE_STORAGE`, so the packer
 * skips them entirely (packed_scene.cpp:865): `reference_bone_name`
 * (`PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_READ_ONLY`,
 * bone_twist_disperser_3d.cpp:151) and the `joints/<j>/bone_name` /
 * `joints/<j>/bone` pair (:161-162). `_set` has no
 * branch for any of them either, so a hand-written scene carrying one has the
 * write DROPPED, and each gets its own read-only rejection rather than the
 * generic unknown-leaf message.
 *
 * The reverse also holds and drives the fixture: these leaves are NOT in
 * ClassDB, so `PropertyUtils::get_property_default_value` returns
 * `is_valid_default = false` for every one whose last path segment is not all
 * digits (property_utils.cpp:182-198), and `_parse_node` omits a property only
 * when that flag is true (packed_scene.cpp:982). Godot therefore writes every
 * live leaf unconditionally, default-valued or not, including `damping_curve =
 * null` — a scene the engine itself emits, and one `v.resourceReference` accepts
 * because `null` is legal in every resource slot.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { accepts, keyShapeError, v } from '../../../../linter/validators/index.js';
import { BONE_DIRECTION } from '../skeletonmodifier3d/linterParser.js';
import { toIntIndex } from '../../../../godot/index.js';

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
 * The single-segment `settings/<i>/<leaf>` leaves, in the order
 * `_get_property_list` pushes them (bone_twist_disperser_3d.cpp:144-158).
 */
const SETTING_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // :144, Variant::STRING, PROPERTY_HINT_ENUM_SUGGESTION over the skeleton's
  // bone names: a dropdown that still accepts free text, so it constrains
  // nothing. set_root_bone_name (:246-253) assigns and then resolves the name.
  root_bone_name: v.quotedString('root_bone_name'),

  // :145, Variant::INT, PROPERTY_HINT_NONE, PROPERTY_USAGE_NO_EDITOR (which
  // still carries STORAGE). -1 is the unset sentinel the setter itself writes.
  // set_root_bone rewrites anything at or below -1, and anything at or past the
  // live bone count, back to -1 (:266-268); the ceiling is a bone count no
  // per-property rule can see, so only the floor is assertable. get_skeleton()
  // may still be null at load, but _validate_bone_names re-runs the same setter
  // on the first skeleton update (:573-574), so a value below -1 cannot survive
  // as written. `strictInt`, since a bone index is discrete and Godot's Variant
  // conversion would truncate a decimal rather than keep it.
  root_bone: v.strictInt('root_bone', { min: -1, enforced: 'bone_twist_disperser_3d.cpp:266-268' }),

  // :146, as root_bone_name; set_end_bone_name is :283-290.
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

  // :151, PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_READ_ONLY, so no STORAGE and
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

  // :153, Variant::QUATERNION, no hint. set_twist_from (:354-357) assigns; the
  // normalisation happens at process time (:770), not in the setter, so an
  // unnormalised quaternion is stored exactly as written.
  twist_from: v.quaternion('twist_from'),

  // :154, PROPERTY_HINT_ENUM "Even,Weighted,Custom", values 0-2.
  // set_disperse_mode (:411-415) stores the static_cast unchecked: warning.
  disperse_mode: v.enumInt('disperse_mode', 0, 2, DISPERSE_MODE, {
    hinted: 'bone_twist_disperser_3d.cpp:154',
  }),

  // :155, Variant::FLOAT, PROPERTY_HINT_RANGE "0,1,0.001", BOTH ends closed,
  // no or_greater and no or_less. set_weight_position (:422-425) assigns
  // straight through with no clamp and no is_finite guard, so a value outside
  // 0-1 loads and runs and is only outside what the inspector slider offers:
  // hinted, a warning at both ends.
  weight_position: v.float('weight_position', {
    min: 0,
    max: 1,
    hinted: 'bone_twist_disperser_3d.cpp:155',
  }),

  // :156, Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE "Curve".
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
  // :161, PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_READ_ONLY (no STORAGE).
  // _update_joints (:600-643) walks the skeleton from end_bone up to root_bone
  // and rebuilds the list; _set's joints branch accepts only twist_amount and
  // returns false for anything else (:71).
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
  // states NO reportable bound (ADR-0032), and set_joint_twist_amount
  // (:499-504) assigns straight through with no clamp and no is_finite guard.
  // Format is the only constraint left.
  twist_amount: v.float('twist_amount'),
};

/** Every `settings/<i>/<leaf>` key whose leaf is a single segment. */
const flatFamily = indexedFamilyValidator({
  // `_set` reads the index with a BARE `to_int` and no `is_valid_int` gate
  // (bone_twist_disperser_3d.cpp:37), and `_to_int` skips non-digits rather
  // than stopping at them (ustring.cpp:2268-2298), so `settings/x/root_bone`
  // resolves to setting 0 and the write LANDS. Reporting it would be a false
  // positive: gating is PropertyListHelper's behaviour, not this class's.
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
 * `settings/<i>/joints/<j>/<leaf>`, the nested indexed family.
 *
 * Both index halves are `[^/]+` rather than digits on purpose: `_set` reads the
 * joint index with the same bare `to_int` (:66), so a non-numeric one resolves
 * to a real joint and the write lands. Demanding digits here would push
 * `settings/0/joints/x/twist_amount` down to `flatFamily`, which would report an
 * unknown leaf for a key Godot accepts.
 *
 * The leaf is ONE segment and a trailing tail is dropped, because `_set` reads
 * it with a fixed `get_slicec('/', 4)` (:67) and never looks past it — so
 * `settings/0/joints/0/twist_amount/extra` reaches the setter as well.
 */
const JOINT_KEY_RE = /^settings\/([^/]+)\/joints\/([^/]+)\/([^/]+)(?:\/.*)?$/;

/**
 * The negative-index error for an index `to_int` resolves below zero.
 *
 * Both index halves are read the way `_set` reads them, with a bare
 * `get_slicec(...).to_int()` and no validity gate (:37, :66), so a spelling
 * `is_valid_int` rejects still names a setting or a joint: `a-1` is -1
 * (ustring.cpp:2291-2292) and the `ERR_FAIL_INDEX_V` beside each parse refuses
 * it. A NaN index — a spelling neither reader can name — fails the comparison
 * and is left alone.
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
 * The whole `settings/` family. The nested `joints/<j>/<leaf>` shape is handled
 * here; everything else goes to `flatFamily`, which owns the index parse, the
 * negative-index refusal and the unknown-leaf message for the common shape.
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

  // bone_twist_disperser_3d.cpp:561, ADD_ARRAY_COUNT (PROPERTY_HINT_NONE, so no
  // hint to fall back on). set_setting_count opens with
  // ERR_FAIL_COND(p_count < 0) (:650): the floor is enforced and a negative
  // count is an error. There is no ceiling anywhere.
  setting_count: v.strictInt('setting_count', {
    min: 0,
    enforced: 'bone_twist_disperser_3d.cpp:650',
  }),

  'settings/*': settingValidator,
});
