/**
 * The skeleton-modifier tree: the `settings/` and `chains/` families each
 * modifier builds by hand in `get_property_list`.
 */

import type { RouteRow } from './types.js';

export const skeletonRoutes: readonly RouteRow[] = [
  // settingsFamilySeam.test.ts proves the ChainIK3D and BoneConstraint3D
  // shadow and delegation contract, so these rows only confirm each family resolves.
  {
    type: 'AimModifier3D',
    at: 'aim_modifier_3d.cpp:84-97',
    sample: 'settings/0/forward_axis',
    verdict: { validated: true },
  },
  {
    type: 'BoneConstraint3D',
    at: 'bone_constraint_3d.cpp:91-115',
    sample: 'settings/0/amount',
    verdict: { validated: true },
  },
  {
    type: 'BoneTwistDisperser3D',
    at: 'bone_twist_disperser_3d.cpp:133-165',
    sample: 'settings/0/joints/0/twist_amount',
    verdict: { validated: true },
  },
  {
    type: 'ChainIK3D',
    at: 'chain_ik_3d.cpp:115-138',
    sample: 'settings/0/root_bone_name',
    verdict: { validated: true },
  },
  {
    type: 'ConvertTransformModifier3D',
    at: 'convert_transform_modifier_3d.cpp:125-167',
    sample: 'settings/0/apply/transform_mode',
    verdict: { validated: true },
  },
  {
    type: 'CopyTransformModifier3D',
    at: 'copy_transform_modifier_3d.cpp:83-101',
    sample: 'settings/0/copy',
    verdict: { validated: true },
  },
  {
    type: 'IterateIK3D',
    at: 'iterate_ik_3d.cpp:113-134',
    sample: 'settings/0/target_node',
    verdict: { validated: true },
  },
  {
    type: 'LimitAngularVelocityModifier3D',
    at: 'limit_angular_velocity_modifier_3d.cpp:90-104',
    sample: 'chains/0/root_bone_name',
    verdict: { validated: true },
  },
  {
    // Same override as the row above; a distinct family (no storage on
    // Godot's own writes) with its own dispatcher and its own row.
    type: 'LimitAngularVelocityModifier3D',
    at: 'limit_angular_velocity_modifier_3d.cpp:105-108',
    sample: 'joints/0/bone_name',
    verdict: { validated: true },
  },
  {
    type: 'SplineIK3D',
    at: 'spline_ik_3d.cpp:79-95',
    sample: 'settings/0/path_3d',
    verdict: { validated: true },
  },
  {
    type: 'SpringBoneSimulator3D',
    at: 'spring_bone_simulator_3d.cpp:282-339',
    sample: 'settings/0/radius/value',
    verdict: { validated: true },
  },
  {
    type: 'TwoBoneIK3D',
    at: 'two_bone_ik_3d.cpp:129-160',
    sample: 'settings/0/target_node',
    verdict: { validated: true },
  },

];
