/** BoneConstraint3D parser: the SkeletonModifier3D parse plus the base `settings/<i>/` leaves. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseSkeletonModifier3D } from '../skeletonmodifier3d/parser';
import { newConstraintSetting, readConstraintSettings } from './settings';
import type { BoneConstraint3DProperties } from './types';

export function parseBoneConstraint3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): BoneConstraint3DProperties {
  return {
    ...parseSkeletonModifier3D(heading, properties),
    settings: readConstraintSettings(properties, newConstraintSetting, {}),
  };
}
