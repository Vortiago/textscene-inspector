/**
 * Line2D parser — Node2D transform/modulate plus the stroked-polyline surface
 * (points, width, default_color, closed flag). Godot defaults: color = white,
 * width = 10, closed = false.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseColor } from '../../../utils/colorParser';
import { boolOr, floatOr, intOr } from '../../../parser/valueParsers';
import { parsePackedVector2Array } from '../../../resources/shapes/packedArray';
import { warn } from '../../../logger';
import type { Line2DProperties } from './types';

export function parseLine2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Line2DProperties {
  const base = parseNode2D(heading, properties);

  let points: Float32Array = new Float32Array(0);
  if (properties.points) {
    try {
      points = parsePackedVector2Array(properties.points);
    } catch (error) {
      warn(
        `Line2D "${base.name}": invalid points ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    ...base,
    points,
    width: floatOr(properties.width, 10, base.name || 'Line2D'),
    defaultColor: properties.default_color
      ? parseColor(properties.default_color)
      : { r: 1, g: 1, b: 1, a: 1 },
    closed: boolOr(properties.closed, false, base.name || 'Line2D'),
    // class_line2d.html: joint_mode 0 (LINE_JOINT_SHARP), sharp_limit 2.0,
    // round_precision 8.
    jointMode: intOr(properties.joint_mode, 0),
    sharpLimit: floatOr(properties.sharp_limit, 2, base.name || 'Line2D'),
    roundPrecision: intOr(properties.round_precision, 8),
  };
}
