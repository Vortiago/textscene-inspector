/**
 * The skeleton-modifier tree: the `settings/` and `chains/` families each
 * modifier builds by hand in `get_property_list`.
 */

import type { RouteRow } from './types.js';

export const skeletonRoutes: readonly RouteRow[] = [
  // --- Skeleton modifier tree: settings/ and chains/ hand-rolled families ---
  // All eleven already validated; settingsFamilySeam.test.ts separately proves
  // the ChainIK3D/BoneConstraint3D SHADOW+delegation contract these dispatchers
  // depend on, so this file only re-confirms each family resolves.
  {
    type: 'AimModifier3D',
    at: 'aim_modifier_3d.cpp:84-97',
    route: 'property-list',
    sample: 'settings/0/forward_axis',
    verdict: { validated: true },
  },
  {
    type: 'BoneConstraint3D',
    at: 'bone_constraint_3d.cpp:91-115',
    route: 'property-list',
    sample: 'settings/0/amount',
    verdict: { validated: true },
  },
  {
    type: 'BoneTwistDisperser3D',
    at: 'bone_twist_disperser_3d.cpp:133-165',
    route: 'property-list',
    sample: 'settings/0/joints/0/twist_amount',
    verdict: { validated: true },
  },
  {
    type: 'ChainIK3D',
    at: 'chain_ik_3d.cpp:115-138',
    route: 'property-list',
    sample: 'settings/0/root_bone_name',
    verdict: { validated: true },
  },
  {
    type: 'ConvertTransformModifier3D',
    at: 'convert_transform_modifier_3d.cpp:125-167',
    route: 'property-list',
    sample: 'settings/0/apply/transform_mode',
    verdict: { validated: true },
  },
  {
    type: 'CopyTransformModifier3D',
    at: 'copy_transform_modifier_3d.cpp:83-101',
    route: 'property-list',
    sample: 'settings/0/copy',
    verdict: { validated: true },
  },
  {
    type: 'IterateIK3D',
    at: 'iterate_ik_3d.cpp:113-134',
    route: 'property-list',
    sample: 'settings/0/target_node',
    verdict: { validated: true },
  },
  {
    type: 'LimitAngularVelocityModifier3D',
    at: 'limit_angular_velocity_modifier_3d.cpp:90-104',
    route: 'property-list',
    sample: 'chains/0/root_bone_name',
    verdict: { validated: true },
  },
  {
    // Same override as the row above; a distinct family (no storage on
    // Godot's own writes) with its own dispatcher and its own row.
    type: 'LimitAngularVelocityModifier3D',
    at: 'limit_angular_velocity_modifier_3d.cpp:105-108',
    route: 'property-list',
    sample: 'joints/0/bone_name',
    verdict: { validated: true },
  },
  {
    type: 'SplineIK3D',
    at: 'spline_ik_3d.cpp:79-95',
    route: 'property-list',
    sample: 'settings/0/path_3d',
    verdict: { validated: true },
  },
  {
    type: 'SpringBoneSimulator3D',
    at: 'spring_bone_simulator_3d.cpp:282-339',
    route: 'property-list',
    sample: 'settings/0/radius/value',
    verdict: { validated: true },
  },
  {
    type: 'TwoBoneIK3D',
    at: 'two_bone_ik_3d.cpp:129-160',
    route: 'property-list',
    sample: 'settings/0/target_node',
    verdict: { validated: true },
  },

];
