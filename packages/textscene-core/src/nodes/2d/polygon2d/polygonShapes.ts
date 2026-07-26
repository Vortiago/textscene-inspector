/**
 * Turn a Polygon2D's raw arrays into the rings the renderer fills.
 *
 * Godot's `polygon_2d.cpp` NOTIFICATION_DRAW decides the shape in one place:
 *
 *   if (invert || polygons.is_empty())  → triangulate `polygon` in stored order
 *   else                                → one sub-polygon per `polygons` entry,
 *                                          each indexing into `polygon`
 *
 * and drops the last `internal_vertex_count` vertices on that first branch —
 * the engine's condition is `(invert || polygons.is_empty()) && internal_vertices > 0`,
 * so the trim applies whenever invert is on as well — because internal vertices
 * are UV/skinning helpers rather than part of the outline.
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
  /**
   * The vertex pool every ring indexes into, in Godot pixel space and in the
   * authored order — `polygon` itself, plus the corners `invert_enabled` adds.
   *
   * Rings are INDICES rather than points so a caller can carry any per-vertex
   * attribute (`uv`, `vertex_colors`) through to the mesh: Godot pairs those
   * arrays with the polygon positionally, so anything that renumbers or
   * duplicates vertices silently mismatches them.
   */
  points: Vector2[];
  /** Filled outlines. One per `polygons` entry, or a single stored-order ring. */
  outlines: number[][];
  /** The punched-out polygon when `invert_enabled` is on, else null. */
  hole: number[] | null;
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
  const allIndices = all.map((_, i) => i);

  if (invertEnabled) {
    // Invert ignores `polygons`, but NOT the internal-vertex trim — Godot's
    // condition is `(invert || polygons.is_empty()) && internal_vertices > 0`,
    // so the trim applies on this branch as much as on the stored-order one.
    // The grown bounds are NEW vertices, appended to the pool so they get
    // indices (and therefore UVs) of their own, as they do in Godot.
    const ring = trimInternal(allIndices, all.length, internalVertexCount);
    if (ring.length < MIN_RING) return { points: all, outlines: [], hole: null };
    const bounds = grownBounds(ring.map((i) => all[i]!), invertBorder);
    const points = [...all, ...bounds];
    const boundsIndices = bounds.map((_, i) => all.length + i);
    return { points, outlines: [boundsIndices], hole: ring };
  }

  if (polygons.length > 0) {
    const outlines = polygons
      .filter((indices) => indices.length >= MIN_RING)
      .map((indices) => indices.filter((i) => all[i] !== undefined))
      .filter((ring) => ring.length >= MIN_RING);
    return { points: all, outlines, hole: null };
  }

  const outline = trimInternal(allIndices, all.length, internalVertexCount);
  return { points: all, outlines: outline.length >= MIN_RING ? [outline] : [], hole: null };
}

/** Drop the trailing UV/skinning helper vertices Godot excludes from the outline. */
function trimInternal(indices: number[], count: number, internalVertexCount: number): number[] {
  return internalVertexCount > 0 ? indices.slice(0, count - internalVertexCount) : indices;
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
