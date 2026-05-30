/** CollisionShape3D parser - parses CollisionShape3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CollisionShape3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';

export function parseCollisionShape3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CollisionShape3DProperties {
  const node3d = parseNode3D(heading, properties);
  const result: CollisionShape3DProperties = { ...node3d };
  if (properties.shape) {
    result.shape = properties.shape;
  }
  if (properties.disabled !== undefined) {
    result.disabled = properties.disabled === 'true';
  }
  return result;
}

export function isCollisionShape3D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'CollisionShape3D';
}
