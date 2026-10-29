/**
 * Triangulates a glyph's contours as Godot does (`primitive_meshes.cpp:3175-3194`): a clockwise
 * contour is a hole, polypartition cuts the glyph into convex pieces, and each piece splits into
 * triangles. A glyph that polypartition fails on has no triangles, and Godot draws no face for it.
 */

import { signedPolygonArea } from '../../../godot/math/polygonArea';
import type { Vector2 } from '../../../godot/math/vector';
import { convexPartition, triangulateMinimumWeight } from './polypartition';

/**
 * The triangles that fill the contours, three points to a triangle, counter-clockwise on a y-up page
 * for contours that wind as a glyph's outer contours do. Empty
 * where Godot fails to partition the glyph, or to triangulate a piece of it.
 */
export function triangulateContours(contours: readonly (readonly Vector2[])[]): Vector2[] {
  const pieces = convexPartition(
    contours.map((points) => ({ points, isHole: signedPolygonArea(points) < 0 }))
  );
  if (!pieces) return [];
  const triangles: Vector2[] = [];
  for (const piece of pieces) {
    const pieceTriangles = triangulateMinimumWeight(piece);
    if (!pieceTriangles) return [];
    triangles.push(...pieceTriangles.flat());
  }
  return triangles;
}
