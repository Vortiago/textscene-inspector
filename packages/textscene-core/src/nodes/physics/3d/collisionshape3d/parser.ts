/** CollisionShape3D parser: the Node3D transform plus the shape, disabled and debug colour. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CollisionShape3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseDebugColor } from '../../shared/debugColor';
import { boolSlotValue } from '../../../../godot/index.js';

export function parseCollisionShape3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CollisionShape3DProperties {
  const node3d = parseNode3D(heading, properties);
  const result: CollisionShape3DProperties = {
    ...node3d,
    debugColor: parseDebugColor(properties.debug_color),
  };
  if (properties.shape) {
    result.shape = properties.shape;
  }
  if (properties.disabled !== undefined) {
    result.disabled = boolSlotValue(properties.disabled) === true;
  }
  return result;
}
