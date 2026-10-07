/**
 * GeometryInstance3D parser: the Node3D transform plus the instance state, which every
 * GeometryInstance3D leaf parser starts from. An unreadable value keeps Godot's default.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';
import { parseNode3D } from '../../base/node3d/parser';
import { GEOMETRY_INSTANCE_DEFAULTS, type GeometryInstance3DProperties } from './types';

export function parseGeometryInstance3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): GeometryInstance3DProperties {
  return {
    ...parseNode3D(heading, properties),
    transparency: parseOptionalFloat(properties.transparency) ?? GEOMETRY_INSTANCE_DEFAULTS.transparency,
    castShadow: parseOptionalInt(properties.cast_shadow) ?? GEOMETRY_INSTANCE_DEFAULTS.castShadow,
  };
}
