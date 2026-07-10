/** CollisionShape2D parser - parses CollisionShape2D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CollisionShape2DProperties } from './types';
import { parseNode2D } from '../../../base/node2d/parser';

export function parseCollisionShape2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CollisionShape2DProperties {
  const node2d = parseNode2D(heading, properties);
  const result: CollisionShape2DProperties = { ...node2d };
  if (properties.shape) {
    result.shape = properties.shape;
  }
  if (properties.disabled !== undefined) {
    result.disabled = properties.disabled === 'true';
  }
  return result;
}
