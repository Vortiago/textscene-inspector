/** BoneConstraint3D type definitions. */

import type { SkeletonModifier3DProperties } from '../skeletonmodifier3d/types';

/** `BoneConstraint3D::BoneConstraint3DSetting` (`bone_constraint_3d.h:44-57`). */
export interface BoneConstraintSetting {
  amount: number;
  applyBoneName: string;
  /** The bone index the file writes, which a name overrides (`bone_constraint_3d.cpp:284-298`). */
  applyBone: number;
  /** A `BoneConstraint3D::ReferenceType` (`bone_constraint_3d.h:39-42`). */
  referenceType: number;
  referenceBoneName: string;
  referenceBone: number;
  /** The `reference_node` path, or an empty string for none. */
  referenceNode: string;
}

/** The properties every BoneConstraint3D reads. */
export interface BoneConstraint3DProperties<
  Setting extends BoneConstraintSetting = BoneConstraintSetting,
> extends SkeletonModifier3DProperties {
  /** One setting for each `settings/<i>/` entry, in the order `setting_count` made them. */
  settings: Setting[];
}
