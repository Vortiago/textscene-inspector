/**
 * ConvertTransformModifier3D strict validators. doc/classes/ConvertTransformModifier3D.xml lists one
 * own member, the one `ADD_ARRAY_COUNT` (convert_transform_modifier_3d.cpp:329), with no `ADD_PROPERTY`.
 * `_get_property_list` (:125-167) builds the rest under `"settings/" + itos(i) + "/"` (:131), and
 * `_set` (:37-79) reads it back through a `where`/`what` pair of path slices.
 */

// Chains through BoneConstraint3D, not past it: that tier owns the seven
// settings/ leaves this registration delegates to, and it chains on to
// SkeletonModifier3D itself.
import { boneConstraintBaseLeaves } from '../boneconstraint3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import { settingCount } from '../shared/settingCount.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { VECTOR3_AXIS } from '../../../../linter/validators/sharedEnumLabels.js';
import { declaredLeafResolver } from '../../../../godot/index.js';

/** ConvertTransformModifier3D::TransformMode (convert_transform_modifier_3d.h:39-43). */
const TRANSFORM_MODE = { 0: 'Position', 1: 'Rotation', 2: 'Scale' };

/**
 * One `apply/` or `reference/` group: an enum pair and a range pair. Both groups are the same four
 * PropertyInfos, and every setter assigns past an `ERR_FAIL_INDEX` on the setting index, never on the
 * value (:183, :196, :208, :220 for `apply`, :232, :245, :257, :269 for `reference`). The cites
 * differ per group, so they are passed in.
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
    // PROPERTY_HINT_RANGE, with the hint picked from the sibling transform_mode (:133-140, :146-153).
    // HINT_POSITION (:33) opens both ends, so no bound holds under every mode, and linter.ts owns the
    // conditional one. The setter has no is_finite guard, so inf and nan load.
    [`${group}/range_min`]: v.float(`${group}/range_min`),
    [`${group}/range_max`]: v.float(`${group}/range_max`),
  };
}

/**
 * The ten leaves ConvertTransformModifier3D itself pushes (:141-160): four under `apply/` (:141-144),
 * the same four under `reference/` (:154-157), and the flat `relative` and `additive` (:159-160).
 */
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
  // it there. The write still lands, so a stored value is inert, not invalid.
  relative: v.boolean('relative'),
  // :160, Variant::BOOL, no hint. set_additive (:293) is a bare assignment.
  additive: v.boolean('additive'),
};

/**
 * Every leaf under the prefix. `_get_property_list` calls the unprefixed
 * `BoneConstraint3D::get_property_list` first (:126), so it also carries the base's seven leaves
 * (bone_constraint_3d.cpp:91-115). This wildcard shadows the base's, so they route back to
 * `findValidator('BoneConstraint3D', …)`. The index split ends at the first `/` after the index,
 * so the base's `apply_bone` and this `apply/axis` never collide.
 */
const SETTING_LEAVES = { ...OWN_LEAVES, ...boneConstraintBaseLeaves() };

/** For the rule: `where` and `what` are slices 2 and 3 (convert_transform_modifier_3d.cpp:42, :44). */
export const resolveConvertSettingLeaf = declaredLeafResolver(Object.keys(SETTING_LEAVES));

const settingValidator = indexedFamilyValidator({
  prefix: 'settings/',
  leaves: SETTING_LEAVES,
  unknownCode: 'INVALID_SETTING_KEY',
  describes: 'setting',
  // No angle brackets: the sheet generator drops this straight into a Markdown
  // table cell (lintCoverage.mjs:131), where `<i>` would open italics.
  accepts:
    'per-setting apply/ and reference/ transform_mode, axis, range_min, range_max, plus relative, additive and the BoneConstraint3D leaves',
  // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()`
  // (convert_transform_modifier_3d.cpp:41) and no `is_valid_int` gate, and
  // `_to_int` skips non-digits (ustring.cpp:2268-2298), so `settings/x/relative`
  // lands on setting 0. Nothing refuses it: this is not the PropertyListHelper parse.
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'convert_transform_modifier_3d.cpp:43',
    code: 'INVALID_SETTING_INDEX',
    message: (index) =>
      `Setting index ${index} must be non-negative. ConvertTransformModifier3D::_set opens with ERR_FAIL_INDEX_V(which, settings.size(), false) (convert_transform_modifier_3d.cpp:43), so the write never lands`,
  },
});

// `leaves` drives `boundGrounding`'s recursion, so it lists bounds, not routes. The seven base
// leaves route into BoneConstraint3D, which cites their bounds. A router is neither `formatOnly`
// (it rejects real values) nor one citation (it forwards to seven).
settingValidator.leaves = Object.values(OWN_LEAVES);

validatorRegistry.registerAll('ConvertTransformModifier3D', {
  // convert_transform_modifier_3d.cpp:329, ADD_ARRAY_COUNT on this class. Its setter is
  // BoneConstraint3D's `set_setting_count`.
  setting_count: settingCount('BoneConstraint3D'),

  // The plain wildcard, not `settings/#/*`: `matchesIndexedKey` routes a single leaf segment, and
  // `indexedFamilyValidator` parses the two-segment `apply/…` leaves itself.
  'settings/*': settingValidator,
});
