/**
 * Which navigation polygons can actually be drawn — the one rule set shared by
 * the NavigationPolygon (2D) and NavigationMesh (3D) slices.
 *
 * Both slices reach the same validation in Godot: a NavigationPolygon is lifted
 * into a NavigationMesh (`Vector3(x, 0, y)` per vertex, polygons copied
 * verbatim — `scene/resources/2d/navigation_polygon.cpp:220-246`) before a region
 * ever sees it, and the region builder then applies two rules per polygon:
 *
 *   - fewer than three indices → skipped
 *     (`modules/navigation_3d/3d/nav_region_builder_3d.cpp:93-96`);
 *   - any index `< 0` or `>= vertex_count` → the whole polygon is rejected as
 *     "Corrupted navigation mesh set on region. The indices of a polygon are out
 *     of range." (`nav_region_builder_3d.cpp:119-141`).
 *
 * Surviving polygons stay whole: the consumer fan-triangulates from index 0,
 * which is Godot's own `Face3(v[0], v[j-1], v[j])` sweep
 * (`nav_region_builder_3d.cpp:107-111`).
 */

import { warn } from '../../logger';

/** Godot's minimum for a polygon that encloses a face. */
const MIN_POLYGON_INDICES = 3;

export function drawableNavigationPolygons(
  polygons: readonly number[][],
  vertexCount: number
): number[][] {
  const drawable: number[][] = [];
  for (const polygon of polygons) {
    if (polygon.length < MIN_POLYGON_INDICES) continue;
    const inRange = polygon.every(
      (index) => Number.isInteger(index) && index >= 0 && index < vertexCount
    );
    if (!inRange) {
      warn(
        `[Navigation] Dropping a polygon whose vertex indices are out of range ` +
          `(${polygon.join(', ')}) for ${vertexCount} vertices.`
      );
      continue;
    }
    drawable.push(polygon);
  }
  return drawable;
}
