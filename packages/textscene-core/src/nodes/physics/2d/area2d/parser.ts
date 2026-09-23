/** Area2D parser: the Node2D transform plus monitoring, monitorable, layer and mask. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { Area2DProperties } from './types';
import { parseNode2D } from '../../../base/node2d/parser';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';

export function parseArea2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Area2DProperties {
  const node2d = parseNode2D(heading, properties);
  const result: Area2DProperties = { ...node2d };

  const monitoring = parseOptionalBool(properties.monitoring);
  if (monitoring !== undefined) result.monitoring = monitoring;

  const monitorable = parseOptionalBool(properties.monitorable);
  if (monitorable !== undefined) result.monitorable = monitorable;

  const collisionLayer = parseOptionalInt(properties.collision_layer, 'uint32');
  if (collisionLayer !== undefined) result.collision_layer = collisionLayer;

  const collisionMask = parseOptionalInt(properties.collision_mask, 'uint32');
  if (collisionMask !== undefined) result.collision_mask = collisionMask;

  return result;
}
