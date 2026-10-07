/**
 * GeometryInstance3D parser: the Node3D transform plus the instance state, which every
 * GeometryInstance3D leaf parser starts from. An unreadable value is dropped silently.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';
import { parseNode3D } from '../../base/node3d/parser';
import type { GeometryInstance3DProperties } from './types';

export function parseGeometryInstance3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): GeometryInstance3DProperties {
  const result: GeometryInstance3DProperties = parseNode3D(heading, properties);
  const transparency = parseOptionalFloat(properties.transparency);
  if (transparency !== undefined) result.transparency = transparency;
  const castShadow = parseOptionalInt(properties.cast_shadow);
  if (castShadow !== undefined) result.castShadow = castShadow;
  return result;
}
