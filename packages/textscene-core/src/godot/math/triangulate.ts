/**
 * Godot's ear-clipping polygon triangulation (`core/math/triangulate.cpp`), as
 * `Geometry2D::triangulate_polygon` calls it. A polygon whose edges cross fails.
 */

import { CMP_EPSILON } from './math';
import { signedPolygonArea } from './polygonArea';
import type { Vector2 } from './vector';

/** `Triangulate::is_inside_triangle` (`triangulate.cpp:46-83`). */
function isInsideTriangle(a: Vector2, b: Vector2, c: Vector2, p: Vector2, includeEdges: boolean): boolean {
  const aCrossBp = (c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x);
  const cCrossAp = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const bCrossCp = (a.x - c.x) * (p.y - c.y) - (a.y - c.y) * (p.x - c.x);
  if (includeEdges) return aCrossBp > 0 && bCrossCp > 0 && cCrossAp > 0;
  return aCrossBp >= 0 && bCrossCp >= 0 && cCrossAp >= 0;
}

/** `Triangulate::snip` (`triangulate.cpp:85-125`): whether the ear at `u, v, w` holds no other point. */
function snip(
  contour: readonly Vector2[],
  [u, v, w]: readonly [number, number, number],
  remaining: readonly number[],
  isRelaxed: boolean
): boolean {
  const a = contour[remaining[u]!]!;
  const b = contour[remaining[v]!]!;
  const c = contour[remaining[w]!]!;
  // Zero-area ears are allowed as a last resort, so a run of aligned points still triangulates.
  const threshold = isRelaxed ? -CMP_EPSILON : CMP_EPSILON;
  if (threshold > (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) return false;
  for (let p = 0; p < remaining.length; p++) {
    if (p === u || p === v || p === w) continue;
    if (isInsideTriangle(a, b, c, contour[remaining[p]!]!, isRelaxed)) return false;
  }
  return true;
}

/**
 * `Geometry2D::triangulate_polygon` (`core/math/geometry_2d.h:355-361`, `Triangulate::triangulate`,
 * `triangulate.cpp:127-206`): three indices into `contour` for each triangle, or none when the
 * polygon has fewer than three points or its edges cross.
 */
export function triangulatePolygon(contour: readonly Vector2[]): number[] {
  const n = contour.length;
  if (n < 3) return [];
  // The ears are clipped from a counter-clockwise ring.
  const isCounterClockwise = signedPolygonArea(contour) > 0;
  const remaining = Array.from({ length: n }, (_, i) => (isCounterClockwise ? i : n - 1 - i));
  const triangles: number[] = [];
  let isRelaxed = false;
  let count = 2 * n;
  for (let v = n - 1; remaining.length > 2;) {
    if (count-- <= 0) {
      if (isRelaxed) return [];
      count = 2 * remaining.length;
      isRelaxed = true;
    }
    const size = remaining.length;
    const u = v >= size ? 0 : v;
    v = u + 1 >= size ? 0 : u + 1;
    const w = v + 1 >= size ? 0 : v + 1;
    if (!snip(contour, [u, v, w], remaining, isRelaxed)) continue;
    triangles.push(remaining[u]!, remaining[v]!, remaining[w]!);
    remaining.splice(v, 1);
    count = 2 * remaining.length;
  }
  return triangles;
}
