/** ShapeCast3D parser: the Node3D transform surface plus the swept shape, `enabled`, `target_position` and the debug colour. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseVector3 } from '../../../../parser/vectors';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import { warn } from '../../../../logger';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';
import { parseNode3D } from '../../../base/node3d/parser';
import type { ShapeCast3DProperties } from './types';

export function parseShapeCast3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): ShapeCast3DProperties {
  const result: ShapeCast3DProperties = { ...parseNode3D(heading, properties) };

  if (properties.enabled !== undefined) {
    result.enabled = boolSlotValue(properties.enabled) === true;
  }

  if (properties.shape) result.shape = properties.shape;

  if (properties.target_position) {
    try {
      result.target_position = parseVector3(properties.target_position);
    } catch (error) {
      warn(
        `[ShapeCast3D] Failed to parse target_position: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const customColor = parseColorOrUndefined(properties.debug_shape_custom_color);
  if (customColor) result.debug_shape_custom_color = customColor;

  return result;
}
