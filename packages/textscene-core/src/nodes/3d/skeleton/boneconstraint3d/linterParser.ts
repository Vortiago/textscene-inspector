/**
 * The seven `settings/<i>/` leaves BoneConstraint3D gives every subclass. The class binds no
 * `ADD_PROPERTY` and its XML lists no member, but `BoneConstraint3D::get_property_list`
 * (bone_constraint_3d.cpp:91-115, unprefixed, so a `_get_property_list` grep misses it) pushes seven
 * PropertyInfos per setting, and every subclass calls it before appending its own.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry, type PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';

/**
 * Here, not in each subclass: the leaf set is identical across all of them and the cites are the
 * base's. Every setter assigns past an `ERR_FAIL_INDEX` on the setting index, never on the value
 * (`bone_constraint_3d.cpp:165`, `:189`, `:208`, `:233`), so no bound here is enforced.
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
  // :104 and :107, PROPERTY_HINT_NONE with PROPERTY_USAGE_NO_EDITOR: hidden from the inspector but
  // serialised. Both setters (:188-196, :232-240) only WARN_PRINT an out-of-range index and keep it.
  // The ceiling is the live bone count, which no validator sees, and -1 is the legal unset default
  // (bone_constraint_3d.h:48, :53), so there is no floor.
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
  // an editor picker filter, and any NodePath parses.
  reference_node: v.nodePath('reference_node'),
};

validatorRegistry.registerAll('BoneConstraint3D', {
  'settings/#/*': indexedFamilyValidator({
    prefix: 'settings/',
    leaves: SETTING_LEAVES,
    unknownCode: 'INVALID_BONE_CONSTRAINT_SETTING',
    describes: 'BoneConstraint3D setting',
    // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()`
    // (bone_constraint_3d.cpp:37) and gates on nothing, so a non-numeric index
    // resolves to a setting rather than being refused, and the write lands.
    indexParse: 'to_int',
    negativeIndex: {
      // Each subclass refuses a negative index in its own `_set`, and the base's
      // accessors do the same through ERR_FAIL_INDEX on `settings.size()`.
      cite: 'bone_constraint_3d.cpp:165',
      message: (index) => `Setting index ${index} is negative, so Godot drops the write`,
      code: 'INVALID_BONE_CONSTRAINT_SETTING_INDEX',
    },
  }),
});

export { SETTING_LEAVES as BONE_CONSTRAINT_SETTING_LEAVES };

/**
 * A router for each of the seven leaves, for a subclass whose own `settings/` wildcard shadows this
 * one, since `findValidator` takes the nearest hop with no fall-through. Keys come from
 * {@link SETTING_LEAVES}, so a new leaf reaches all three subclasses. `linter/settingsFamilySeam.test.ts`
 * asserts this with the whole barrel, since a scoped test cannot see the shadow.
 */
export function boneConstraintBaseLeaves(): Readonly<Record<string, PropertyValidator>> {
  // Resolved per call, not captured at load, so the delegation holds whichever registration ran
  // first. Call this once at module load: each call allocates a closure and a seven-entry object.
  const delegate: PropertyValidator = (key, value, line) =>
    validatorRegistry.findValidator('BoneConstraint3D', key)?.(key, value, line) ?? null;
  return Object.fromEntries(Object.keys(SETTING_LEAVES).map((leaf) => [leaf, delegate]));
}
