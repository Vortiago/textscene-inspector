/**
 * SpringArm3D parser: the Node3D transform surface plus `spring_length`, the
 * only key the length gizmo draws from. It keeps `inf` and `nan`, which the
 * gizmo draws as nothing.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseGodotFloat } from '../../../../godot/variant/number.js';
import type { SpringArm3DProperties } from './types';

export function parseSpringArm3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): SpringArm3DProperties {
  return {
    ...parseNode3D(heading, properties),
    spring_length: parseGodotFloat(properties.spring_length ?? '') ?? undefined,
  };
}
