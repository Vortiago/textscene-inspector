/**
 * CopyTransformModifier3D strict validators for linting.
 *
 * doc/classes/CopyTransformModifier3D.xml lists ONE member without an
 * `overrides=` attribute, `setting_count`, and the class binds no `ADD_PROPERTY`
 * at all. The rest of its serialised surface is hand-rolled: `_get_property_list`
 * (copy_transform_modifier_3d.cpp:83-101) builds a `settings/<i>/<leaf>` family
 * that appears in no macro, so an ADD_PROPERTY-only reading of this class sees
 * nothing but the count.
 *
 * ## The `settings/` family is SPLIT across two classes
 *
 * `CopyTransformModifier3D::_get_property_list` calls
 * `BoneConstraint3D::get_property_list(p_list)` first (copy_transform_modifier_3d.cpp:84
 * — note the UNPREFIXED name, declared bone_constraint_3d.h:66) and only then
 * appends its own leaves. So one prefix carries leaves from two classes:
 *
 * - BoneConstraint3D's, bone_constraint_3d.cpp:102-108 — `amount`,
 *   `apply_bone_name`, `apply_bone`, `reference_type`, `reference_bone_name`,
 *   `reference_bone`, `reference_node`. Shared with every sibling constraint
 *   (AimModifier3D, ConvertTransformModifier3D), so they belong on the abstract
 *   base, not here.
 * - This class's, copy_transform_modifier_3d.cpp:90-94 — `copy`, `axes`,
 *   `invert`, `relative`, `additive`. Those are the five below.
 *
 * `ValidatorRegistry`'s wildcards are PREFIX-granular, so one registration owns
 * `settings/` for this node type and shadows anything an ancestor registers
 * under the same prefix. Rejecting an unrecognised leaf the way
 * `indexedFamilyValidator` does would therefore false-positive on
 * `settings/0/amount`, which every real scene writes. The dispatcher instead
 * rejects only a key whose SHAPE is not `settings/<index>/<leaf>` and hands any
 * leaf this class does not own back to `findValidator('BoneConstraint3D', …)`,
 * which reproduces exactly the walk that would have run had this wildcard not
 * matched.
 */

// Chains through BoneConstraint3D, not past it: that tier owns the seven
// settings/ leaves this class's dispatcher delegates to, and it chains on to
// SkeletonModifier3D itself.
import '../boneconstraint3d/linterParser.js';
import {
  validatorRegistry,
  type PropertyValidator,
} from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { propertyError } from '../../../../linter/validators/propertyError.js';

/**
 * A `PROPERTY_HINT_FLAGS` int whose setter assigns straight through.
 *
 * NOT `maskedBitField`: that models `x = p_flags & MASK`, and none of these
 * three setters masks anything (copy_transform_modifier_3d.cpp:120, :133, :146
 * are bare assignments to an `int64_t`-backed `BitField`). The only bound is the
 * inspector's flag list, which is the warning tier under ADR-0032.
 *
 * A `min`/`max` pair is exact here for the same reason it is wrong for a sparse
 * mask: all three hinted bits are contiguous from bit 0, so `0..7` IS the set of
 * subsets and there is no in-range non-subset for a bound to wave through.
 *
 * @param hinted - `file:line` of the `PropertyInfo` carrying the FLAGS hint.
 */
function flagsField(
  name: string,
  labels: Record<number, string>,
  hinted: string
): PropertyValidator {
  const named = Object.entries(labels)
    .map(([bit, label]) => `${label} (${bit})`)
    .join(' | ');
  const all = Object.keys(labels).reduce((bits, bit) => bits | Number(bit), 0);
  const validator = v.int(name, {
    min: 0,
    max: all,
    hinted,
    message: `Property '${name}' is a bit mask of ${named}; the inspector's flag list offers no other bit, so Godot keeps the value but nothing can edit it`,
  });
  validator.accepts = `bit mask of ${named}`;
  return validator;
}

/** copy_transform_modifier_3d.h:40-42, the TransformFlag bits. */
const TRANSFORM_FLAGS: Record<number, string> = {
  1: 'Position',
  2: 'Rotation',
  4: 'Scale',
};

/** copy_transform_modifier_3d.h:47-49, the AxisFlag bits. */
const AXIS_FLAGS: Record<number, string> = { 1: 'X', 2: 'Y', 4: 'Z' };

/**
 * The five leaves CopyTransformModifier3D adds to `settings/<i>/`
 * (copy_transform_modifier_3d.cpp:90-94). Keyed by leaf name.
 */
const OWN_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // copy_transform_modifier_3d.cpp:90, PROPERTY_HINT_FLAGS
  // "Position,Rotation,Scale". set_copy_flags assigns straight through
  // (copy_transform_modifier_3d.cpp:120).
  copy: flagsField('copy', TRANSFORM_FLAGS, 'copy_transform_modifier_3d.cpp:90'),
  // copy_transform_modifier_3d.cpp:91, PROPERTY_HINT_FLAGS "X,Y,Z".
  // set_axis_flags assigns straight through (copy_transform_modifier_3d.cpp:133).
  axes: flagsField('axes', AXIS_FLAGS, 'copy_transform_modifier_3d.cpp:91'),
  // copy_transform_modifier_3d.cpp:92, PROPERTY_HINT_FLAGS "X,Y,Z".
  // set_invert_flags assigns straight through (copy_transform_modifier_3d.cpp:146).
  invert: flagsField('invert', AXIS_FLAGS, 'copy_transform_modifier_3d.cpp:92'),
  // copy_transform_modifier_3d.cpp:93, Variant::BOOL, no hint. set_relative is a
  // bare assignment (copy_transform_modifier_3d.cpp:303). The key is hidden when
  // the setting references a node rather than a bone
  // (copy_transform_modifier_3d.cpp:107-109) and `is_relative()` then reads
  // false whatever is stored (copy_transform_modifier_3d.h:61-66), but the write
  // still lands, so the value is inert rather than invalid: no rule, no removal.
  relative: v.boolean('relative'),
  // copy_transform_modifier_3d.cpp:94, Variant::BOOL, no hint. set_additive is a
  // bare assignment (copy_transform_modifier_3d.cpp:315).
  additive: v.boolean('additive'),
};

/** `settings/` — the array prefix ADD_ARRAY_COUNT names (copy_transform_modifier_3d.cpp:358). */
const SETTINGS_PREFIX = 'settings/';

/**
 * Dispatch `settings/<i>/<leaf>`, owning five leaves and delegating the rest.
 *
 * The key parse mirrors the engine's own (`_set`,
 * copy_transform_modifier_3d.cpp:36-38): split at the LAST `/`, require the head
 * to start with the prefix, read the index that sits between.
 *
 * The index is read with a BARE `to_int()` and no validity gate
 * (copy_transform_modifier_3d.cpp:37), and `_to_int` skips non-digits rather
 * than stopping at them (ustring.cpp:2268-2298), so `settings/x/relative`
 * resolves to setting 0 and the write LANDS. Nothing refuses it, so ADR-0032
 * grounds no diagnostic on a non-numeric index and only a NEGATIVE one, which
 * `ERR_FAIL_INDEX_V` does refuse, is reportable. The leaf below still decides
 * either way: an unrecognised one is dropped whatever the index came to.
 */
const settingsValidator: PropertyValidator = (key, value, line) => {
  const slash = key.lastIndexOf('/');
  const indexText = slash > SETTINGS_PREFIX.length ? key.slice(SETTINGS_PREFIX.length, slash) : '';
  const leafName = key.slice(slash + 1);

  if (!key.startsWith(SETTINGS_PREFIX) || indexText === '' || leafName === '') {
    return propertyError(key, line, `Unknown setting property: "${key}"`, 'INVALID_SETTING_KEY');
  }

  // `[+-]?`, matching `String::to_int()`'s sign handling. A non-match is a
  // non-numeric index, which the engine resolves rather than refusing, so it
  // falls through uncommented-on.
  if (/^[+-]?\d+$/.test(indexText) && Number(indexText) < 0) {
    return propertyError(
      key,
      line,
      `Setting index ${Number(indexText)} must be non-negative; CopyTransformModifier3D::_set refuses it before the write lands`,
      'INVALID_SETTING_INDEX'
    );
  }

  // hasOwnProperty, so a leaf named `toString` cannot resolve an inherited
  // function and get called as a validator.
  const leaf = Object.prototype.hasOwnProperty.call(OWN_LEAVES, leafName)
    ? OWN_LEAVES[leafName]
    : undefined;
  if (leaf) return leaf(key, value, line);

  // Not one of this class's five, so it is BoneConstraint3D's (or nobody's).
  // Resolving from the base rather than rejecting is what keeps this wildcard
  // from shadowing the ancestor that owns the other seven leaves.
  return validatorRegistry.findValidator('BoneConstraint3D', key)?.(key, value, line) ?? null;
};

settingsValidator.accepts =
  'settings/<i>/ copy, axes, invert (bit masks), relative, additive (bool)';
// The rejected index is a real value a scene can carry, and the guard that
// refuses it is `ERR_FAIL_INDEX_V(which, (int)settings.size(), false)`.
settingsValidator.grounding = { kind: 'enforced', cite: 'copy_transform_modifier_3d.cpp:39' };
// Exposed so `boundGrounding`'s sweep recurses past the dispatcher: a tag here
// says nothing about the bounds behind it.
settingsValidator.leaves = Object.values(OWN_LEAVES);

validatorRegistry.registerAll('CopyTransformModifier3D', {
  // copy_transform_modifier_3d.cpp:358, ADD_ARRAY_COUNT (no hint string). The
  // property is this class's — BoneConstraint3D binds no ADD_ARRAY_COUNT, and
  // each concrete subclass declares its own — while the setter it names lives on
  // the base: `set_setting_count` opens `ERR_FAIL_COND(p_count < 0)`
  // (bone_constraint_3d.cpp:131), so the floor is enforced. There is no ceiling.
  setting_count: v.int('setting_count', { min: 0, enforced: 'bone_constraint_3d.cpp:131' }),

  'settings/#/*': settingsValidator,
});
