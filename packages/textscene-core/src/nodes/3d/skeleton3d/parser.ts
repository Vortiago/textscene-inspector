/** Skeleton3D parser: the Node3D base parse plus the bone table and `show_rest_only`. */

import type { ParsedHeading } from '../../../parser/utils';
import { boolOr } from '../../../parser/valueParsers';
import { parseNode3D } from '../../base/node3d/parser';
import { readBones } from './readBones';
import type { Skeleton3DProperties } from './types';

export function parseSkeleton3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Skeleton3DProperties {
  return {
    ...parseNode3D(heading, properties),
    bones: readBones(properties),
    showRestOnly: boolOr(properties.show_rest_only, false, 'Skeleton3D show_rest_only'),
  };
}
