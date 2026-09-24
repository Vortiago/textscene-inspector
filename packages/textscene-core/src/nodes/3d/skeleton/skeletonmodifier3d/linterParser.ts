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

/*
 * The enum label tables below are SkeletonModifier3D's own: its header declares them, and its
 * `get_hint_*()` helpers build the hint strings the subclasses pass to `PROPERTY_HINT_ENUM`. They
 * live here, not in `sharedEnumLabels.ts`, which takes only tables with no common ancestor, and
 * every descendant already imports this module. `Vector3::Axis` is core's, so it stays there.
 */

/** `SkeletonModifier3D::BoneAxis` declaration order (skeleton_modifier_3d.h:45-50). */
export const BONE_AXIS: Readonly<Record<number, string>> = {
  0: '+X',
  1: '-X',
  2: '+Y',
  3: '-Y',
  4: '+Z',
  5: '-Z',
};

/**
 * `SkeletonModifier3D::BoneDirection`, skeleton_modifier_3d.h:55-62, in the order of
 * `get_hint_bone_direction()` (skeleton_modifier_3d.h:64). Spelled out, not derived from {@link
 * BONE_AXIS}: the two agree on 0-5, but they are separate C++ enums and either can be reordered
 * alone.
 */
export const BONE_DIRECTION: Readonly<Record<number, string>> = {
  0: '+X',
  1: '-X',
  2: '+Y',
  3: '-Y',
  4: '+Z',
  5: '-Z',
  6: 'FromParent',
};

/**
 * `SkeletonModifier3D::SecondaryDirection`, skeleton_modifier_3d.h:67-75, in the order of
 * `get_hint_secondary_direction()`: PROPERTY_HINT_ENUM "None,+X,-X,+Y,-Y,+Z,-Z,Custom"
 * (skeleton_modifier_3d.h:77).
 */
export const SECONDARY_DIRECTION: Readonly<Record<number, string>> = {
  0: 'None',
  1: '+X',
  2: '-X',
  3: '+Y',
  4: '-Y',
  5: '+Z',
  6: '-Z',
  7: 'Custom',
};

/**
 * `SkeletonModifier3D::RotationAxis`: PROPERTY_HINT_ENUM "X,Y,Z,All,Custom"
 * (skeleton_modifier_3d.h:87).
 */
export const ROTATION_AXIS: Readonly<Record<number, string>> = {
  0: 'X',
  1: 'Y',
  2: 'Z',
  3: 'All',
  4: 'Custom',
};

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
