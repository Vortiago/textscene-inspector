/**
 * RectangleShape2D decode: property bag in, rectangle size out.
 *
 * `rectangle_shape_2d.cpp:61` ERR_FAILs when either component is negative,
 * refusing the whole assignment, so the rectangle keeps its 20x20 default.
 */

import { nonNegativeSizeOr, vec2Or } from '../../../parser/valueParsers';
import type { RectangleShape2DProperties } from './types';

const DEFAULT_SIZE = { x: 20, y: 20 };

export function decodeRectangleShape2D(
  properties: Record<string, string>
): RectangleShape2DProperties {
  return {
    size: nonNegativeSizeOr(
      vec2Or(properties.size, DEFAULT_SIZE, 'RectangleShape2D size'),
      DEFAULT_SIZE,
      'RectangleShape2D size'
    ),
  };
}
