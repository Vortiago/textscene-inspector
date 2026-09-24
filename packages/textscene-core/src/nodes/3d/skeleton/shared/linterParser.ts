/**
 * Validators every IKModifier3D-derived node shares, under the abstract key 'IKModifier3D', which
 * Godot cannot instantiate. The base-walk carries them to ChainIK3D and TwoBoneIK3D, to IterateIK3D
 * and SplineIK3D under ChainIK3D, and to CCDIK3D, FABRIK3D and JacobianIK3D under IterateIK3D.
 * Declare only the members doc/classes/IKModifier3D.xml lists without `overrides=`.
 */

// A tier has no index.linter.ts and registers only when imported. Chaining to the parent tier makes
// SkeletonModifier3D's keys reach an IKModifier3D subtree whichever leaf slices exist.
import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// `setting_count` and the `settings/<i>/` family stay out. The base supplies only storage and
// `_set_setting_count<T>` (ik_modifier_3d.h:98, `ERR_FAIL_COND(p_count < 0)`), and each subclass
// declares its own leaf set, so a family here would deliver the wrong leaves.
validatorRegistry.registerAll('IKModifier3D', {
  // ik_modifier_3d.cpp:64, the only ADD_PROPERTY: Variant::BOOL with no hint. set_mutable_bone_axes
  // (ik_modifier_3d.cpp:156) assigns and flags the settings dirty, so format is the only constraint
  // (ADR-0032).
  mutable_bone_axes: v.boolean('mutable_bone_axes'),
});
