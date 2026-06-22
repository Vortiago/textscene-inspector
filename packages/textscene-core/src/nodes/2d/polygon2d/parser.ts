/**
 * Polygon2D parser — Node2D transform/modulate plus the filled-polygon surface
 * (polygon outline, flat fill color, offset, optional texture reference).
 * Godot defaults: color = white, offset = (0,0).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseColor } from '../../../utils/colorParser';
import { vec2Or } from '../../../parser/valueParsers';
import { parsePackedVector2Array } from '../../../resources/shapes/packedArray';
import { warn } from '../../../logger';
import type { Polygon2DProperties } from './types';

export function parsePolygon2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Polygon2DProperties {
  const base = parseNode2D(heading, properties);

  let polygon: Float32Array = new Float32Array(0);
  if (properties.polygon) {
    try {
      polygon = parsePackedVector2Array(properties.polygon);
    } catch (error) {
      warn(
        `Polygon2D "${base.name}": invalid polygon ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const result: Polygon2DProperties = {
    ...base,
    polygon,
    color: properties.color ? parseColor(properties.color) : { r: 1, g: 1, b: 1, a: 1 },
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, base.name || 'Polygon2D'),
  };

  if (properties.texture) result.texture = properties.texture;

  return result;
}
