/** CopyTransformModifier3D type definitions. */

import type { BoneConstraint3DProperties, BoneConstraintSetting } from '../boneconstraint3d/types';

/** `CopyTransformModifier3D::CopyTransform3DSetting` (`copy_transform_modifier_3d.h:57-70`). */
export interface CopyTransformSetting extends BoneConstraintSetting {
  /** A bit mask of `TransformFlag`: position 1, rotation 2, scale 4. */
  copyFlags: number;
  /** A bit mask of `AxisFlag`: X 1, Y 2, Z 4. */
  axisFlags: number;
  invertFlags: number;
  /** Whether the copy is relative to the rest. Reads false for a reference node (`:61-66`). */
  relative: boolean;
  additive: boolean;
}

export type CopyTransformModifier3DProperties = BoneConstraint3DProperties<CopyTransformSetting>;
