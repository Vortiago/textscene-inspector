/**
 * Which navigation polygons can be drawn, for the 2D and 3D slices alike: Godot
 * lifts a NavigationPolygon into a NavigationMesh (`Vector3(x, 0, y)` per vertex,
 * polygons verbatim, `scene/resources/2d/navigation_polygon.cpp:220-246`) before
 * the region builder applies its two rules per polygon.
 */

import { warn } from '../../logger';

/**
 * Godot skips a polygon with fewer indices
 * (`modules/navigation_3d/3d/nav_region_builder_3d.cpp:93-96`).
 */
const MIN_POLYGON_INDICES = 3;

export function drawableNavigationPolygons(
  polygons: readonly number[][],
  vertexCount: number
): number[][] {
  const drawable: number[][] = [];
  for (const polygon of polygons) {
    if (polygon.length < MIN_POLYGON_INDICES) continue;
    // An index `< 0` or `>= vertex_count` rejects the whole polygon as "Corrupted
    // navigation mesh set on region" (`nav_region_builder_3d.cpp:119-141`).
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
    // Whole: the consumer fan-triangulates from index 0, Godot's own
    // `Face3(v[0], v[j-1], v[j])` sweep (`nav_region_builder_3d.cpp:107-111`).
    drawable.push(polygon);
  }
  return drawable;
}
