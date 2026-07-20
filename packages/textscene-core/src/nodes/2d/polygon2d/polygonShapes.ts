/**
 * Turn a Polygon2D's raw arrays into the rings the renderer fills.
 *
 * Godot's `polygon_2d.cpp` NOTIFICATION_DRAW decides the shape in one place:
 *
 *   if (invert || polygons.is_empty())  → triangulate `polygon` in stored order
 *   else                                → one sub-polygon per `polygons` entry,
 *                                          each indexing into `polygon`
 *
 * and drops the last `internal_vertex_count` vertices only on that first
 * branch, because internal vertices are UV/skinning helpers rather than part of
 * the outline.
 *
 * `invert_enabled` fills the polygon's AABB grown by `invert_border` with the
 * polygon punched out — Godot builds that as one bridged ring, which is
 * equivalent to (and much clearer as) an outline plus a hole.
 *
 * Pure geometry, in Godot's +Y-down pixel space: the caller applies `offset`
 * and the Y negation.
 */

import type { Vector2 } from '../../base/node2d/types';

export interface PolygonRings {
  /** Filled outlines. One per `polygons` entry, or a single stored-order ring. */
  outlines: Vector2[][];
  /** The punched-out polygon when `invert_enabled` is on, else null. */
  hole: Vector2[] | null;
}

/** Minimum vertices for a fillable ring. */
const MIN_RING = 3;

export function polygonRings(
  polygon: Float32Array,
  polygons: number[][],
  internalVertexCount: number,
  invertEnabled: boolean,
  invertBorder: number
): PolygonRings {
  const all = toPoints(polygon);

  if (invertEnabled) {
    // Invert ignores `polygons` and the internal-vertex trim alike.
    const ring = all;
    if (ring.length < MIN_RING) return { outlines: [], hole: null };
    return { outlines: [grownBounds(ring, invertBorder)], hole: ring };
  }

  if (polygons.length > 0) {
    const outlines = polygons
      .filter((indices) => indices.length >= MIN_RING)
      .map((indices) => indices.map((i) => all[i]).filter((p): p is Vector2 => p !== undefined))
      .filter((ring) => ring.length >= MIN_RING);
    return { outlines, hole: null };
  }

  const outline = internalVertexCount > 0 ? all.slice(0, all.length - internalVertexCount) : all;
  return { outlines: outline.length >= MIN_RING ? [outline] : [], hole: null };
}

function toPoints(flat: Float32Array): Vector2[] {
  const points: Vector2[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    points.push({ x: flat[i]!, y: flat[i + 1]! });
  }
  return points;
}

/** The ring's axis-aligned bounds, grown by `border` on every side. */
function grownBounds(ring: Vector2[], border: number): Vector2[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return [
    { x: minX - border, y: minY - border },
    { x: maxX + border, y: minY - border },
    { x: maxX + border, y: maxY + border },
    { x: minX - border, y: maxY + border },
  ];
}
