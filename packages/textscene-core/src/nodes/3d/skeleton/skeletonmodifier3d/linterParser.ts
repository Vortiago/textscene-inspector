/**
 * SkeletonModifier3D strict validators. Declare only SkeletonModifier3D's own members, the ones
 * doc/classes/SkeletonModifier3D.xml lists without `overrides=`. The NODE_BASE_TYPES base-walk
 * delivers every key from Node3D up, and re-declaring one shadows it and duplicates the rule.
 */

// The base chain. Registration happens on import, so a test that loads only this slice resolves an
// inherited key only when the ancestor is imported too.
import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

/**
 * `SkeletonModifier3D::get_axis_from_bone_axis` (skeleton_modifier_3d.cpp:244-260): a `BoneAxis`
 * reduced to the `Vector3::Axis` it lies along, so `+X` and `-X` both give 0. The switch has no
 * default case and seeds `ret` with `AXIS_X`, so a value outside 0-5 resolves to X, and Godot
 * compares it as it would a legal one.
 */
export function axisFromBoneAxis(boneAxis: number): number {
  if (boneAxis < 0 || boneAxis > 5) return 0;
  return Math.floor(boneAxis / 2);
}

validatorRegistry.registerAll('SkeletonModifier3D', {
  active: v.boolean('active'),
  // scene/3d/skeleton_modifier_3d.cpp:161, ADD_PROPERTY(..., "influence",
  // PROPERTY_HINT_RANGE, "0,1,0.001"); set_influence (:111) is a bare assignment.
  influence: v.float('influence', { min: 0, max: 1, hinted: 'skeleton_modifier_3d.cpp:161' }),
});
