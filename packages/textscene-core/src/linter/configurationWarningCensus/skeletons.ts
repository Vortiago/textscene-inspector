/**
 * Bone, IK and skeleton-modifier nodes.
 *
 * Most rows are parent-or-ancestor checks — a modifier with no `Skeleton3D`
 * above it, a `Bone2D` chain that never reaches a `Skeleton2D` — and the rest
 * name a per-setting target the modifier leaves unset.
 */
import type { WarningRow } from './types.js';

export const skeletonWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  AimModifier3D: [
    {
      at: 'aim_modifier_3d.cpp:103',
      says: 'forward axis and primary rotation axis must not be parallel',
      verdict: { rule: 'aimmodifier3d-parallel-rotation-axes' },
    },
  ],

  Bone2D: [
    {
      at: 'skeleton_2d.cpp:418',
      says: 'this Bone2D chain should end at a Skeleton2D node',
      verdict: { rule: 'bone2d-chain-does-not-terminate' },
    },
    {
      at: 'skeleton_2d.cpp:420',
      says: 'a Bone2D only works with a Skeleton2D or another Bone2D as parent',
      verdict: { rule: 'bone2d-invalid-parent' },
    },
    {
      at: 'skeleton_2d.cpp:425',
      says: 'this bone lacks a proper REST pose',
      verdict: { rule: 'bone2d-missing-rest-pose' },
    },
  ],

  BoneAttachment3D: [
    {
      at: 'bone_attachment_3d.cpp:65',
      says: 'external Skeleton3D node not set',
      verdict: { rule: 'boneattachment3d-external-skeleton-unset' },
    },
    {
      at: 'bone_attachment_3d.cpp:70',
      says: 'parent node is not a Skeleton3D node',
      verdict: { rule: 'boneattachment3d-parent-not-skeleton3d' },
    },
    {
      at: 'bone_attachment_3d.cpp:75',
      says: 'not bound to any bones',
      verdict: {
        declined: 'default-omitted',
        because: 'bone_idx field-initialises to -1 (bone_attachment_3d.cpp:348), which is the trigger itself',
      },
    },
  ],

  IterateIK3D: [
    {
      at: 'iterate_ik_3d.cpp:162',
      says: 'a setting has no target set',
      verdict: { rule: 'iterateik3d-setting-missing-target-node' },
    },
  ],

  LookAtModifier3D: [
    {
      at: 'look_at_modifier_3d.cpp:73',
      says: 'forward axis and primary rotation axis must not be parallel',
      verdict: { rule: 'lookatmodifier3d-parallel-rotation-axes' },
    },
  ],

  PhysicalBone2D: [
    {
      at: 'physical_bone_2d.cpp:113',
      says: 'requires a Skeleton2D ancestor to function',
      verdict: { rule: 'physicalbone2d-missing-skeleton-parent' },
    },
    {
      at: 'physical_bone_2d.cpp:116',
      says: 'no bone assigned',
      verdict: { rule: 'physicalbone2d-missing-bone-index' },
    },
    {
      at: 'physical_bone_2d.cpp:121',
      says: 'needs a Joint2D child to keep bones together',
      verdict: { rule: 'physicalbone2d-missing-joint-child' },
    },
  ],

  RetargetModifier3D: [
    {
      at: 'retarget_modifier_3d.cpp:36',
      says: 'there is no child Skeleton3D',
      verdict: { rule: 'retargetmodifier3d-no-child-skeleton' },
    },
  ],

  SkeletonModifier3D: [
    {
      at: 'skeleton_modifier_3d.cpp:36',
      says: 'Skeleton3D node not set; must be a child of Skeleton3D',
      verdict: { rule: 'skeletonmodifier3d-parent-not-skeleton3d' },
    },
  ],

  SplineIK3D: [
    {
      at: 'spline_ik_3d.cpp:113',
      says: 'a setting has no Path3D set',
      verdict: { rule: 'splineik3d-setting-without-path-3d' },
    },
  ],

  SpringBoneCollision3D: [
    {
      at: 'spring_bone_collision_3d.cpp:40',
      says: 'parent should be a SpringBoneSimulator3D node',
      verdict: { rule: 'springbonecollision3d-outside-springbonesimulator3d' },
    },
  ],

  TwoBoneIK3D: [
    {
      at: 'two_bone_ik_3d.cpp:196',
      says: 'a setting has no target set',
      verdict: { rule: 'twoboneik3d-setting-missing-target-node' },
    },
  ],
};
