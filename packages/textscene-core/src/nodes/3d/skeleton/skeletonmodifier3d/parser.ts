/** SkeletonModifier3D parser: the Node3D base parse plus `active` and `influence`. */

import type { ParsedHeading } from '../../../../parser/utils';
import { boolOr, realOr } from '../../../../parser/valueParsers';
import { parseNode3D } from '../../../base/node3d/parser';
import type { SkeletonModifier3DProperties } from './types';

export function parseSkeletonModifier3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): SkeletonModifier3DProperties {
  return {
    ...parseNode3D(heading, properties),
    active: boolOr(properties.active, true, 'SkeletonModifier3D active'),
    influence: realOr(properties.influence, 1, 'SkeletonModifier3D influence'),
  };
}
