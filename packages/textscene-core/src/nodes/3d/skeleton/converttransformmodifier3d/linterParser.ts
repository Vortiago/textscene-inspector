/**
 * ConvertTransformModifier3D strict validators for linting.
 *
 * doc/classes/ConvertTransformModifier3D.xml lists ONE member without an
 * `overrides=` attribute, `setting_count`, and `_bind_methods` binds exactly one
 * `ADD_ARRAY_COUNT` (convert_transform_modifier_3d.cpp:329) and no `ADD_PROPERTY`
 * at all. Everything else the class serialises is hand-rolled in
 * `_get_property_list` (:125-167), which appears in no macro.
 *
 * ## Ten leaves per setting, eight of them two segments deep
 *
 * `String path = "settings/" + itos(i) + "/"` (:131) and then, per setting,
 * `apply/transform_mode`, `apply/axis`, `apply/range_min`, `apply/range_max`
 * (:141-144), the same four under `reference/` (:154-157), and the flat
 * `relative` and `additive` (:159-160). `_set` (:37-79) reads them back through
 * a `where` / `what` pair of path slices, which is what makes the two-segment
 * shape legal in the first place.
 *
 * The family therefore registers under the PLAIN `settings/*` wildcard, not the
 * glued-index `settings/#/*`: `ValidatorRegistry.matchesIndexedKey` routes a
 * single leaf segment only, so a nested key registered under `#/*` would reach
 * no validator at all and every value on it would be silently accepted.
 * `indexedFamilyValidator` itself parses any depth, keyed by the leaf's full
 * path below the index, so this slice needs no dispatcher of its own.
 *
 * ## The `settings/` family is SPLIT across two classes
 *
 * `_get_property_list` calls `BoneConstraint3D::get_property_list(p_list)` first
 * (:126 — note the UNPREFIXED name), so the same prefix also carries the base's
 * seven leaves (bone_constraint_3d.cpp:91-115). `findValidator` resolves ONE
 * wildcard per key with no fall-through, so this registration SHADOWS the
 * base's; the seven are named below as routers back into
 * `findValidator('BoneConstraint3D', …)`, which reproduces exactly the walk that
 * would have run had this wildcard not matched. Note `apply_bone` (the base's
 * flat leaf) beside `apply/axis` (this class's nested group): the index split
 * ends at the first `/` after the index, so the two never collide.
 *
 * ## The range hint is chosen by a SIBLING, so no validator here bounds it
 *
 * `range_min` / `range_max` carry `PROPERTY_HINT_RANGE` with a hint string
 * picked at runtime from the neighbouring `transform_mode` (:133-140 and
 * :146-153):
 *
 *   HINT_POSITION "-10,10,0.01,or_greater,or_less,suffix:m"  (:33)
 *   HINT_ROTATION "-180,180,0.01,radians_as_degrees"         (:34)
 *   HINT_SCALE    "0,10,0.01,or_greater"                     (:35)
 *
 * A per-property validator cannot see that sibling, so the only bound it could
 * state is the one true under EVERY mode — and HINT_POSITION carries both
 * `or_greater` and `or_less`, which opens both ends and grounds nothing at all
 * (ADR-0032). Assuming rotation instead would reject a legal position range.
 * So these four validators check the float format and claim no magnitude; the
 * mode-conditional bound is `linter.ts`'s, where the sibling is readable.
 */

// Chains through BoneConstraint3D, not past it: that tier owns the seven
// settings/ leaves this registration delegates to, and it chains on to
// SkeletonModifier3D itself.
import { BONE_CONSTRAINT_SETTING_LEAVES } from '../boneconstraint3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { VECTOR3_AXIS } from '../../../../linter/validators/sharedEnumLabels.js';

/** ConvertTransformModifier3D::TransformMode (convert_transform_modifier_3d.h:39-43). */
const TRANSFORM_MODE = { 0: 'Position', 1: 'Rotation', 2: 'Scale' };

/**
 * One `apply/` or `reference/` group: an enum pair and a range pair.
 *
 * Both groups are byte-for-byte the same four PropertyInfos under a different
 * path segment, and both sets of setters are bare assignments past an
 * `ERR_FAIL_INDEX` on the setting INDEX, never on the value
 * (:183, :196, :208, :220 for `apply`; :232, :245, :257, :269 for `reference`).
 * The citations differ per group, so they are passed in rather than derived.
 *
 * @param group - `apply` or `reference`, the path segment and the leaf prefix.
 * @param modeCite - `file:line` of the transform_mode PropertyInfo.
 * @param axisCite - `file:line` of the axis PropertyInfo.
 */
function transformGroup(
  group: 'apply' | 'reference',
  modeCite: string,
  axisCite: string
): Record<string, PropertyValidator> {
  return {
    // PROPERTY_HINT_ENUM "Position,Rotation,Scale". The setter static_casts an
    // arbitrary int to TransformMode and assigns it, so an out-of-range value
    // loads intact and only the inspector's dropdown is exceeded: a warning.
    [`${group}/transform_mode`]: v.enumInt(`${group}/transform_mode`, 0, 2, TRANSFORM_MODE, {
      hinted: modeCite,
    }),
    // PROPERTY_HINT_ENUM "X,Y,Z", the same static_cast-and-assign shape.
    [`${group}/axis`]: v.enumInt(`${group}/axis`, 0, 2, VECTOR3_AXIS, { hinted: axisCite }),
    // PROPERTY_HINT_RANGE, but the hint STRING is chosen from the sibling
    // transform_mode and one of the three arms opens both ends, so no bound
    // holds unconditionally. See the header; linter.ts owns the conditional one.
    // No is_finite guard anywhere in the setter either, so inf and nan load.
    [`${group}/range_min`]: v.float(`${group}/range_min`),
    [`${group}/range_max`]: v.float(`${group}/range_max`),
  };
}

/** The ten leaves ConvertTransformModifier3D itself pushes (:141-160). */
const OWN_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  ...transformGroup(
    'apply',
    'convert_transform_modifier_3d.cpp:141',
    'convert_transform_modifier_3d.cpp:142'
  ),
  ...transformGroup(
    'reference',
    'convert_transform_modifier_3d.cpp:154',
    'convert_transform_modifier_3d.cpp:155'
  ),
  // :159, Variant::BOOL, no hint. set_relative (:281) is a bare assignment.
  // `_validate_dynamic_prop` (:169-177) clears this key to PROPERTY_USAGE_NONE
  // while the setting's reference_type is not Bone, so Godot stops serialising
  // it there — but the write still lands, which makes a stored value inert
  // rather than invalid: no rule, no removal.
  relative: v.boolean('relative'),
  // :160, Variant::BOOL, no hint. set_additive (:293) is a bare assignment.
  additive: v.boolean('additive'),
};

/**
 * The seven leaves BoneConstraint3D pushes into the same family
 * (bone_constraint_3d.cpp:91-115) are DELEGATED, not re-declared and not waved
 * through.
 *
 * They have to be named here because this registration owns the `settings/`
 * prefix for this node type and the dispatcher would otherwise report a legal
 * key as unknown. But the bounds belong to the base, so each one forwards there.
 * Resolving at call time rather than at module scope keeps it independent of
 * import order.
 */
const delegateToBase: PropertyValidator = (key, value, line) =>
  validatorRegistry.findValidator('BoneConstraint3D', key)?.(key, value, line) ?? null;

const BASE_LEAVES: Readonly<Record<string, PropertyValidator>> = Object.fromEntries(
  // Derived from the base's own table rather than re-spelled here. A hand-copy
  // would go stale silently in the worst direction: an eighth leaf on
  // BoneConstraint3D would make this dispatcher report a LEGAL key as
  // INVALID_SETTING_KEY, and only `amount` is covered by settingsFamilySeam's
  // canary, so nothing would go red.
  Object.keys(BONE_CONSTRAINT_SETTING_LEAVES).map((leaf) => [leaf, delegateToBase])
);

const settingValidator = indexedFamilyValidator({
  prefix: 'settings/',
  leaves: { ...OWN_LEAVES, ...BASE_LEAVES },
  unknownCode: 'INVALID_SETTING_KEY',
  describes: 'setting',
  // No angle brackets: the sheet generator drops this straight into a Markdown
  // table cell (lintCoverage.mjs:131), where `<i>` would open italics.
  accepts:
    'per-setting apply/ and reference/ transform_mode, axis, range_min, range_max, plus relative, additive and the BoneConstraint3D leaves',
  // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()`
  // (convert_transform_modifier_3d.cpp:41) and no `is_valid_int` gate, and
  // `_to_int` skips non-digits (ustring.cpp:2268-2298), so `settings/x/relative`
  // resolves to setting 0 and the write LANDS. Nothing refuses it, so nothing is
  // reported: this is NOT the PropertyListHelper parse, which drops such a key.
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'convert_transform_modifier_3d.cpp:43',
    code: 'INVALID_SETTING_INDEX',
    message: (index) =>
      `Setting index ${index} must be non-negative. ConvertTransformModifier3D::_set opens with ERR_FAIL_INDEX_V(which, settings.size(), false) (convert_transform_modifier_3d.cpp:43), so the write never lands`,
  },
});

// `leaves` drives `boundGrounding`'s recursion, so it must list BOUNDS, not
// routes. The seven BASE_LEAVES entries are routers into BoneConstraint3D,
// where the real validators are swept with their own citations; the only honest
// tag for a router is neither `formatOnly` (it does reject real values) nor a
// citation (it forwards to seven different ones).
settingValidator.leaves = Object.values(OWN_LEAVES);

validatorRegistry.registerAll('ConvertTransformModifier3D', {
  // convert_transform_modifier_3d.cpp:329, ADD_ARRAY_COUNT (PROPERTY_HINT_NONE,
  // so no ceiling). The setter it names is BoneConstraint3D's, and
  // `set_setting_count` opens `ERR_FAIL_COND(p_count < 0)`
  // (bone_constraint_3d.cpp:131): a delegated setter carries the delegate's
  // guard, so the floor is enforced and a negative count is an error.
  setting_count: v.int('setting_count', { min: 0, enforced: 'bone_constraint_3d.cpp:131' }),

  'settings/*': settingValidator,
});
