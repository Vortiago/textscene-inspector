/**
 * ConvexPolygonShape2D decode: `points` in, the corners out. `set_points` stores the array as
 * given (`convex_polygon_shape_2d.cpp:86-90`). Malformed or hand-edited data degrades to an empty
 * polygon, which draws nothing, rather than throwing through the render tree.
 */

import { packedOr } from '../../../parser/valueParsers';
import { NO_FLOATS, parsePackedVector2Array, vector2Elements } from '../packedArray';
import type { ConvexPolygonShape2DProperties } from './types';

export function decodeConvexPolygonShape2D(
  properties: Record<string, string>
): ConvexPolygonShape2DProperties {
  return {
    points: vector2Elements(
      packedOr(properties.points, parsePackedVector2Array, NO_FLOATS, 'ConvexPolygonShape2D points')
    ),
  };
}
