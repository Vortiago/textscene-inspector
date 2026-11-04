/**
 * Line2D parser: the Node2D transform and modulate, and the polyline properties.
 * Godot defaults: color = white, width = 10, closed = false, both caps NONE.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseColor } from '../../../utils/colorParser';
import { boolOr, floatOr, intOr, packedOr } from '../../../parser/valueParsers';
import { NO_FLOATS, parsePackedVector2Array } from '../../../resources/shapes/packedArray';
import type { Line2DProperties } from './types';
import { LineCapMode, LineJointMode } from '../../../godot/scene/line2d.js';

export function parseLine2D(heading: ParsedHeading, properties: Record<string, string>): Line2DProperties {
  const base = parseNode2D(heading, properties);

  const points = packedOr(
    properties.points,
    parsePackedVector2Array,
    NO_FLOATS,
    `Line2D "${base.name}".points`
  );

  return {
    ...base,
    points,
    width: floatOr(properties.width, 10, base.name || 'Line2D'),
    defaultColor: properties.default_color
      ? parseColor(properties.default_color)
      : { r: 1, g: 1, b: 1, a: 1 },
    closed: boolOr(properties.closed, false, base.name || 'Line2D'),
    // class_line2d.html: sharp_limit 2.0, round_precision 8.
    jointMode: intOr(properties.joint_mode, LineJointMode.SHARP),
    sharpLimit: floatOr(properties.sharp_limit, 2, base.name || 'Line2D'),
    roundPrecision: Math.max(1, intOr(properties.round_precision, 8)),
    beginCapMode: intOr(properties.begin_cap_mode, LineCapMode.NONE),
    endCapMode: intOr(properties.end_cap_mode, LineCapMode.NONE),
    gradient: properties.gradient,
    widthCurve: properties.width_curve,
  };
}
