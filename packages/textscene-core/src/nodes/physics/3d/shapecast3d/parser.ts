/** ShapeCast3D parser: the Node3D transform surface plus the swept shape, `enabled`, `target_position` and the debug colour. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool } from '../../../../parser/valueParsers';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseCastTargetPosition } from '../../shared/castTarget';
import type { ShapeCast3DProperties } from './types';

export function parseShapeCast3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): ShapeCast3DProperties {
  const result: ShapeCast3DProperties = { ...parseNode3D(heading, properties) };

  const enabled = parseOptionalBool(properties.enabled);
  if (enabled !== undefined) result.enabled = enabled;

  if (properties.shape) result.shape = properties.shape;

  const targetPosition = parseCastTargetPosition(properties, 'ShapeCast3D');
  if (targetPosition !== undefined) result.target_position = targetPosition;

  const customColor = parseColorOrUndefined(properties.debug_shape_custom_color);
  if (customColor) result.debug_shape_custom_color = customColor;

  return result;
}
