/**
 * CopyTransformModifier3D strict validators. doc/classes/CopyTransformModifier3D.xml lists one own
 * member, `setting_count`, and the class binds no `ADD_PROPERTY`. `_get_property_list`
 * (copy_transform_modifier_3d.cpp:83-101) builds a `settings/<i>/<leaf>` family after it calls
 * `BoneConstraint3D::get_property_list` (copy_transform_modifier_3d.cpp:84, bone_constraint_3d.h:66).
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
import { settingCount } from '../shared/settingCount.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { boneConstraintBaseLeaves } from '../boneconstraint3d/linterParser.js';

/**
 * A `PROPERTY_HINT_FLAGS` int whose setter assigns to an `int64_t` `BitField` unmasked
 * (copy_transform_modifier_3d.cpp:120, :133, :146), so not `maskedBitField`, which models
 * `x = p_flags & MASK`. The flag list bounds the inspector only: a warning (ADR-0032). `min`/`max` is
 * exact, since the three bits are contiguous from bit 0, so `0..7` is the set of subsets.
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
  // copy_transform_modifier_3d.cpp:93, BOOL, no hint, and set_relative assigns
  // (copy_transform_modifier_3d.cpp:303). The key is hidden while the setting references a node
  // (copy_transform_modifier_3d.cpp:107-109), and `is_relative()` then reads false
  // (copy_transform_modifier_3d.h:61-66), but the write lands, so a stored value is inert, not invalid.
  relative: v.boolean('relative'),
  // copy_transform_modifier_3d.cpp:94, Variant::BOOL, no hint. set_additive is a
  // bare assignment (copy_transform_modifier_3d.cpp:315).
  additive: v.boolean('additive'),
};

const settingsValidator = indexedFamilyValidator({
  prefix: 'settings/',
  // Its own five, plus a router to each of BoneConstraint3D's seven (bone_constraint_3d.cpp:102-108),
  // which the base declares for every sibling constraint. Wildcards are prefix-granular, so this one
  // shadows the base's, and the routers repeat the walk to `findValidator('BoneConstraint3D', …)`.
  leaves: { ...OWN_LEAVES, ...boneConstraintBaseLeaves() },
  unknownCode: 'INVALID_SETTING_KEY',
  describes: 'setting',
  // No angle brackets: the sheet generator drops this straight into a Markdown
  // table cell (lintCoverage.mjs:131), where `<i>` would open italics.
  accepts: 'per-setting copy, axes and invert bit masks, plus relative and additive',
  // `_set` reads the index with a bare `to_int()` and no validity gate
  // (copy_transform_modifier_3d.cpp:37), and `_to_int` skips non-digits (ustring.cpp:2268-2298), so
  // `settings/x/relative` lands on setting 0, and a non-numeric index draws nothing.
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'copy_transform_modifier_3d.cpp:39',
    code: 'INVALID_SETTING_INDEX',
    message: (index) =>
      `Setting index ${index} must be non-negative; CopyTransformModifier3D::_set refuses it before the write lands`,
  },
});

// `leaves` drives `boundGrounding`'s recursion, so it lists bounds, not routes: the seven base
// routers forward to seven citations, which no single tag can stand for.
settingsValidator.leaves = Object.values(OWN_LEAVES);

validatorRegistry.registerAll('CopyTransformModifier3D', {
  // copy_transform_modifier_3d.cpp:358, ADD_ARRAY_COUNT, this class's own, since
  // BoneConstraint3D binds none. Its setter is the base's `set_setting_count`.
  setting_count: settingCount('BoneConstraint3D'),

  'settings/#/*': settingsValidator,
});
