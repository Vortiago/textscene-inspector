/** SpringArm3D parser: the Node3D transform surface plus `spring_length`. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';
import { writtenScalarSlotValue } from '../../../../godot/variant/variantBool.js';
import type { SpringArm3DProperties } from './types';

export function parseSpringArm3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): SpringArm3DProperties {
  return {
    ...parseNode3D(heading, properties),
    spring_length: writtenScalarSlotValue(properties.spring_length),
  };
}
