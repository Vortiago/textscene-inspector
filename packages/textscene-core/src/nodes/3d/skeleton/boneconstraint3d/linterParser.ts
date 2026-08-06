/**
 * The `settings/<i>/` leaves BoneConstraint3D contributes to every subclass.
 *
 * The class binds ZERO `ADD_PROPERTY` and its XML lists no member, which is why
 * it sat in `ownValidatorCoverage`'s `NO_OWN_PROPERTIES` as "the constraint
 * parameters live on each subclass". That was wrong:
 * `BoneConstraint3D::get_property_list` (bone_constraint_3d.cpp:91-115, and note
 * the name is UNPREFIXED, so a `_get_property_list` grep misses it) pushes seven
 * PropertyInfos per setting, and every subclass calls it before appending its
 * own. Those seven appear in every real scene and were validated nowhere.
 *
 * They live here rather than in each subclass because the leaf set is identical
 * across all of them and the citations are the base's own lines.
 *
 * ## Reaching a subclass requires delegation, not inheritance
 *
 * `findValidator` walks the base chain and the NEAREST hop wins, with no
 * fall-through. Every concrete subclass registers its own `settings/` wildcard
 * for the leaves it appends, so that registration SHADOWS this one. The base's
 * bounds arrive only because each subclass's dispatcher forwards an unrecognised
 * leaf here via `findValidator('BoneConstraint3D', key)`.
 *
 * That contract is asserted in `linter/settingsFamilySeam.test.ts`,
 * which loads the whole barrel: a per-slice test cannot see the shadow, because
 * a scoped test loads only its own module graph.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';

/**
 * Every setter below is a bare assignment past an `ERR_FAIL_INDEX` on the
 * setting INDEX, never on the value, so no bound here is enforced: the guards
 * that look like enforcement (`bone_constraint_3d.cpp:165`, `:189`, `:208`,
 * `:233`) all check which setting is addressed.
 */
const SETTING_LEAVES = {
  // bone_constraint_3d.cpp:102, PROPERTY_HINT_RANGE "0,1,0.001", both ends
  // closed. set_amount (:164-167) assigns straight through.
  amount: v.float('amount', { min: 0, max: 1, hinted: 'bone_constraint_3d.cpp:102' }),
  // :103 and :106, PROPERTY_HINT_ENUM_SUGGESTION over the live bone names. A
  // suggestion list populates a dropdown and still accepts free text, so it
  // constrains nothing.
  apply_bone_name: v.quotedString('apply_bone_name'),
  reference_bone_name: v.quotedString('reference_bone_name'),
  // :104 and :107, PROPERTY_HINT_NONE with PROPERTY_USAGE_NO_EDITOR, which
  // hides them from the inspector but still serialises them. Both setters
  // (:188-196, :232-240) only WARN_PRINT an out-of-range index and keep the
  // value, and the real ceiling is the live Skeleton3D's bone count, which no
  // per-property validator can see. -1 is the legal unset default
  // (bone_constraint_3d.h:48, :53), so there is not even a floor.
  apply_bone: v.strictInt('apply_bone'),
  reference_bone: v.strictInt('reference_bone'),
  // :105, PROPERTY_HINT_ENUM "Bone,Node" over the two-value ReferenceType
  // (bone_constraint_3d.h:39-42). set_reference_type (:207-211) assigns without
  // an ERR_FAIL_INDEX on the value.
  reference_type: v.enumInt(
    'reference_type',
    0,
    1,
    { 0: 'REFERENCE_TYPE_BONE', 1: 'REFERENCE_TYPE_NODE' },
    { hinted: 'bone_constraint_3d.cpp:105' }
  ),
  // :108, PROPERTY_HINT_NODE_PATH_VALID_TYPES "Node3D". The type restriction is
  // an editor picker filter; any NodePath parses.
  reference_node: v.nodePath('reference_node'),
};

validatorRegistry.registerAll('BoneConstraint3D', {
  'settings/#/*': indexedFamilyValidator({
    prefix: 'settings/',
    leaves: SETTING_LEAVES,
    unknownCode: 'INVALID_BONE_CONSTRAINT_SETTING',
    describes: 'BoneConstraint3D setting',
    negativeIndex: {
      // Each subclass refuses a negative index in its own `_set`; the base's
      // accessors do the same through ERR_FAIL_INDEX on `settings.size()`.
      cite: 'bone_constraint_3d.cpp:165',
      message: (index) => `Setting index ${index} is negative, so Godot drops the write`,
      code: 'INVALID_BONE_CONSTRAINT_SETTING_INDEX',
    },
  }),
});

export { SETTING_LEAVES as BONE_CONSTRAINT_SETTING_LEAVES };
