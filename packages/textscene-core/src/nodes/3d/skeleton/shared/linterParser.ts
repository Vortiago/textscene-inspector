/**
 * Validators shared by every IKModifier3D-derived node.
 *
 * Registered under the abstract key 'IKModifier3D', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches all
 * seven descendants through the NODE_BASE_TYPES base-walk: ChainIK3D and
 * TwoBoneIK3D directly, IterateIK3D and SplineIK3D under ChainIK3D, and
 * CCDIK3D, FABRIK3D and JacobianIK3D under IterateIK3D.
 *
 * Declare only IKModifier3D's OWN members: the ones doc/classes/IKModifier3D.xml
 * lists without an `overrides=` attribute, cross-checked against ADD_PROPERTY
 * in the .cpp. Quote the governing source line beside every non-obvious bound.
 *
 * `setting_count` and the `settings/<i>/` family stay OUT of this tier. The
 * base only supplies the storage and the `_set_setting_count<T>` template
 * (ik_modifier_3d.h:98, `ERR_FAIL_COND(p_count < 0)`); the serialised
 * properties are declared per subclass, and the leaf sets differ per branch,
 * so a family registered here would deliver the wrong leaves to both.
 */

// A tier has no index.linter.ts, so it registers only when something imports
// it. Chaining to the parent tier here is what makes that reachability a
// property of the chain rather than an accident of which leaf slices happen to
// exist: without it, SkeletonModifier3D's keys would reach an IKModifier3D
// subtree only if some unrelated slice pulled them in.
import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('IKModifier3D', {
  // ik_modifier_3d.cpp:64, the class's only ADD_PROPERTY: a bare
  // PropertyInfo(Variant::BOOL, ...) with no hint. set_mutable_bone_axes
  // (ik_modifier_3d.cpp:156) assigns and flags the settings dirty, refusing
  // and altering nothing, so format is the only constraint (ADR-0032).
  mutable_bone_axes: v.boolean('mutable_bone_axes'),
});
