/**
 * RayCast3D parser: the Node3D transform surface plus `enabled`, `target_position`,
 * `debug_shape_thickness` and the debug colour.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseVector3 } from '../../../../parser/vectors';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import { warn } from '../../../../logger';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';
import { parseNode3D } from '../../../base/node3d/parser';
import type { RayCast3DProperties } from './types';

export function parseRayCast3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): RayCast3DProperties {
  const result: RayCast3DProperties = { ...parseNode3D(heading, properties) };

  if (properties.enabled !== undefined) {
    result.enabled = boolSlotValue(properties.enabled) === true;
  }

  if (properties.target_position) {
    try {
      result.target_position = parseVector3(properties.target_position);
    } catch (error) {
      warn(
        `[RayCast3D] Failed to parse target_position: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const thickness = parseOptionalInt(properties.debug_shape_thickness);
  if (thickness !== undefined) result.debug_shape_thickness = thickness;

  const customColor = parseColorOrUndefined(properties.debug_shape_custom_color);
  if (customColor) result.debug_shape_custom_color = customColor;

  return result;
}
