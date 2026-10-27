/** The signed area of a polygon, as Godot's `Triangulate::get_area` sums it. */

import type { Vector2 } from './vector';

/**
 * `Triangulate::get_area` (`core/math/triangulate.cpp:33-43`): the shoelace sum of `p.cross(q)`, halved.
 * It is positive for a counter-clockwise ring, y up. Double, not `real_t`: callers read its sign
 * and compare areas, and no caller draws the value.
 *
 * @oneWay The signed area of a polygon
 */
export function signedPolygonArea(points: readonly Vector2[]): number {
  let doubledArea = 0;
  for (let p = points.length - 1, q = 0; q < points.length; p = q++) {
    doubledArea += points[p]!.x * points[q]!.y - points[p]!.y * points[q]!.x;
  }
  return doubledArea * 0.5;
}
