/**
 * AimModifier3D strict validators: its own members, as the base-walk delivers BoneConstraint3D and
 * up. doc/classes/AimModifier3D.xml lists one, the ADD_ARRAY_COUNT (aim_modifier_3d.cpp:190), with no
 * ADD_PROPERTY. The rest is the family `_get_property_list` builds as `"settings/" + itos(i)`
 * (aim_modifier_3d.cpp:84-97), which `_set`/`_get` read back (aim_modifier_3d.cpp:34-82).
 */

// Chains through BoneConstraint3D, not past it: that tier owns the seven
// settings/ leaves this class's dispatcher delegates to, and it chains on to
// SkeletonModifier3D itself.
import { boneConstraintBaseLeaves } from '../boneconstraint3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import { settingCount } from '../shared/settingCount.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { BONE_AXIS } from '../skeletonmodifier3d/linterParser.js';
import { VECTOR3_AXIS } from '../../../../linter/validators/sharedEnumLabels.js';
import { declaredLeafResolver } from '../../../../godot/index.js';

/**
 * The five leaves AimModifier3D itself pushes (aim_modifier_3d.cpp:91-95). `primary_rotation_axis`
 * and `use_secondary_rotation` are PROPERTY_USAGE_DEFAULT while `use_euler` is true (the ternary at
 * aim_modifier_3d.cpp:89), so both serialise and need a validator.
 */
const AIM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // aim_modifier_3d.cpp:91, Variant::INT, PROPERTY_HINT_ENUM "+X,-X,+Y,-Y,+Z,-Z"
  // (skeleton_modifier_3d.h:52), values 0-5. The static_cast at aim_modifier_3d.cpp:43 does not
  // clamp, and set_forward_axis (aim_modifier_3d.cpp:117) and set_primary_rotation_axis
  // (aim_modifier_3d.cpp:144) assign past an index guard, so both axis enums warn (ADR-0032).
  forward_axis: v.enumInt('forward_axis', 0, 5, BONE_AXIS, { hinted: 'aim_modifier_3d.cpp:91' }),
  // aim_modifier_3d.cpp:92, Variant::BOOL, no hint.
  use_euler: v.boolean('use_euler'),
  // aim_modifier_3d.cpp:93, Variant::INT, PROPERTY_HINT_ENUM "X,Y,Z", values 0-2.
  primary_rotation_axis: v.enumInt('primary_rotation_axis', 0, 2, VECTOR3_AXIS, {
    hinted: 'aim_modifier_3d.cpp:93',
  }),
  // aim_modifier_3d.cpp:94, Variant::BOOL, PROPERTY_HINT_NONE.
  use_secondary_rotation: v.boolean('use_secondary_rotation'),
  // aim_modifier_3d.cpp:95, Variant::BOOL, no hint.
  relative: v.boolean('relative'),
};

/**
 * Every leaf under the prefix. `_get_property_list` calls `BoneConstraint3D::get_property_list`
 * first (aim_modifier_3d.cpp:85), so it also carries the base's seven leaves
 * (bone_constraint_3d.cpp:102-108). They route to the base, which owns their bounds.
 */
const SETTING_LEAVES = { ...AIM_LEAVES, ...boneConstraintBaseLeaves() };

/** For the rule: `what = path.get_slicec('/', 2)` (aim_modifier_3d.cpp:39). */
export const resolveAimSettingLeaf = declaredLeafResolver(Object.keys(SETTING_LEAVES));

const settingValidator = indexedFamilyValidator({
  prefix: 'settings/',
  leaves: SETTING_LEAVES,
  unknownCode: 'INVALID_SETTING_KEY',
  describes: 'setting',
  // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()`
  // (aim_modifier_3d.cpp:38) and gates on nothing, so a non-numeric index
  // resolves to a setting and the write lands.
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'aim_modifier_3d.cpp:40',
    code: 'INVALID_SETTING_INDEX',
    message: (index) =>
      `Setting index ${index} must be non-negative. AimModifier3D::_set refuses an out-of-range index (aim_modifier_3d.cpp:40), so the write never lands`,
  },
});

// `leaves` drives `boundGrounding`'s recursion, so it lists bounds, not routes. The seven base
// leaves route into BoneConstraint3D, which cites their bounds. A router is neither `formatOnly`
// (it rejects real values) nor one citation (it forwards to seven).
settingValidator.leaves = Object.values(AIM_LEAVES);

validatorRegistry.registerAll('AimModifier3D', {
  // aim_modifier_3d.cpp:190, ADD_ARRAY_COUNT on this class. The setter is
  // BoneConstraint3D::set_setting_count: a delegated setter carries the delegate's guard.
  setting_count: settingCount('BoneConstraint3D'),

  // `itos(i)` glues the index to the prefix as `PropertyListHelper` does, so the glued-index
  // matcher reads `settings/0/forward_axis`.
  'settings/#/*': settingValidator,
});
