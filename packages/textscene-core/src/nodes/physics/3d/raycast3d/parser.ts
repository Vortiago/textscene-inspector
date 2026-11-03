/**
 * RayCast3D parser: the Node3D transform surface plus `enabled`, `target_position`,
 * `debug_shape_thickness` and the debug colour.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseCastTargetPosition } from '../../shared/castTarget';
import type { RayCast3DProperties } from './types';

export function parseRayCast3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): RayCast3DProperties {
  const result: RayCast3DProperties = { ...parseNode3D(heading, properties) };

  const enabled = parseOptionalBool(properties.enabled);
  if (enabled !== undefined) result.enabled = enabled;

  const targetPosition = parseCastTargetPosition(properties, 'RayCast3D');
  if (targetPosition !== undefined) result.target_position = targetPosition;

  const thickness = parseOptionalInt(properties.debug_shape_thickness);
  if (thickness !== undefined) result.debug_shape_thickness = thickness;

  const customColor = parseColorOrUndefined(properties.debug_shape_custom_color);
  if (customColor) result.debug_shape_custom_color = customColor;

  return result;
}
