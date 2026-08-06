/**
 * AimModifier3D strict validators for linting.
 *
 * Declare only AimModifier3D's OWN members. Everything from BoneConstraint3D up
 * is registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk,
 * so re-declaring an inherited key shadows it and duplicates the rule.
 *
 * ## ADD_PROPERTY is not the surface here
 *
 * doc/classes/AimModifier3D.xml lists one member, `setting_count`, and
 * `_bind_methods` binds exactly one ADD_ARRAY_COUNT (aim_modifier_3d.cpp:190)
 * and no ADD_PROPERTY at all. The rest of what a scene carries is a hand-rolled
 * indexed family: `AimModifier3D::_get_property_list` (aim_modifier_3d.cpp:84-97)
 * builds `String path = "settings/" + itos(i) + "/"` and pushes five leaves,
 * with `_set`/`_get` (aim_modifier_3d.cpp:34-82) reading them back. Registered
 * under `settings/#/*` so ValidatorRegistry's glued-index matcher applies: the
 * index is glued to the prefix by `itos(i)` exactly as `PropertyListHelper`
 * glues it, so a scene writes `settings/0/forward_axis`.
 *
 * ## Two classes share the one `settings/` family
 *
 * `_get_property_list` calls `BoneConstraint3D::get_property_list(p_list)` first
 * (aim_modifier_3d.cpp:85), so the SAME `settings/<i>/` prefix also carries
 * BoneConstraint3D's own seven leaves (bone_constraint_3d.cpp:102-108). They are
 * recognised below so a real scene is not reported as carrying unknown keys, and
 * deliberately left unvalidated: their bounds are the base's to declare, and
 * validating them here would claim a key this class does not own.
 *
 * ## Both axis enums are hints, not enforcement
 *
 * `set_forward_axis` (aim_modifier_3d.cpp:117) and `set_primary_rotation_axis`
 * (aim_modifier_3d.cpp:144) are bare assignments past an index guard. The
 * `static_cast<BoneAxis>` at aim_modifier_3d.cpp:43 is a cast, not a clamp, so
 * an out-of-range value is stored intact and only the PROPERTY_HINT_ENUM is
 * exceeded: warning, never error (ADR-0032).
 */

// Chains through BoneConstraint3D, not past it: that tier owns the seven
// settings/ leaves this class's dispatcher delegates to, and it chains on to
// SkeletonModifier3D itself.
import { BONE_CONSTRAINT_SETTING_LEAVES } from '../boneconstraint3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { BONE_AXIS } from '../skeletonmodifier3d/linterParser.js';
import { VECTOR3_AXIS } from '../../../../linter/validators/sharedEnumLabels.js';

/**
 * The five leaves AimModifier3D itself pushes (aim_modifier_3d.cpp:91-95).
 *
 * `primary_rotation_axis` and `use_secondary_rotation` carry a usage that is
 * PROPERTY_USAGE_DEFAULT only while `use_euler` is true (the ternary at
 * aim_modifier_3d.cpp:89), so both serialise in that configuration and both
 * need a validator; the conditional NONE is a visibility switch, not a
 * permanently unserialised key.
 */
const AIM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // aim_modifier_3d.cpp:91, Variant::INT, PROPERTY_HINT_ENUM
  // "+X,-X,+Y,-Y,+Z,-Z" (skeleton_modifier_3d.h:52), values 0-5.
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
 * The seven leaves BoneConstraint3D pushes into the same family
 * (bone_constraint_3d.cpp:102-108) are DELEGATED, not re-declared and not
 * waved through.
 *
 * They have to be named here because this class's dispatcher owns the
 * `settings/` prefix for this node type and would otherwise report a legal key
 * as unknown. But the bounds belong to the base, so each one forwards there.
 * `findValidator` walks the base chain and the NEAREST hop wins with no
 * fall-through, so this dispatcher SHADOWS the base's registration; forwarding
 * is what puts the base's bounds back. Resolving at call time rather than at
 * module scope keeps it independent of import order.
 *
 * The alternative, accepting all seven unconditionally, would have made
 * `settings/0/amount = 5` silently legal on this type while the identical key
 * is correctly bounded to 0..1 on a plain BoneConstraint3D.
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
  leaves: { ...AIM_LEAVES, ...BASE_LEAVES },
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

// `leaves` drives `boundGrounding`'s recursion, so it must list BOUNDS, not
// routes. The seven BASE_LEAVES entries above are routers into
// BoneConstraint3D, where the real validators are swept with their own
// citations; leaving them here would ask this slice to classify a bound it
// does not own, and the only honest tag for a router is neither `formatOnly`
// (it does reject real values) nor a citation (it forwards to seven different
// ones).
settingValidator.leaves = Object.values(AIM_LEAVES);

validatorRegistry.registerAll('AimModifier3D', {
  // aim_modifier_3d.cpp:190, ADD_ARRAY_COUNT (PROPERTY_HINT_NONE, so no
  // ceiling). The setter is BoneConstraint3D::set_setting_count, whose
  // ERR_FAIL_COND(p_count < 0) (bone_constraint_3d.cpp:131) refuses the write
  // outright: a delegated setter carries the delegate's guard.
  setting_count: v.int('setting_count', { min: 0, enforced: 'bone_constraint_3d.cpp:131' }),

  'settings/#/*': settingValidator,
});
