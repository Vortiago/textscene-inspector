/**
 * Turns a Polygon2D's raw arrays into the rings the renderer fills, in Godot's
 * +Y-down pixels. As in `polygon_2d.cpp` NOTIFICATION_DRAW: with `invert` or no
 * `polygons`, one ring in stored order, less the trailing `internal_vertex_count`
 * UV/skinning helpers. Otherwise, one ring per `polygons` entry.
 */

import type { Vector2 } from '../../base/node2d/types';

export interface PolygonRings {
  /**
   * The vertex pool every ring indexes into, in authored order: `polygon`, plus
   * the corners `invert_enabled` adds. Rings are indices so `uv` and
   * `vertex_colors`, which Godot pairs with points by position, stay aligned.
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
    // Invert ignores `polygons` but still trims. Godot builds one bridged ring,
    // and an outline of the bounds grown by `invert_border` with the polygon as a hole
    // is equivalent. The bound corners are new vertices with their own indices,
    // so their own UVs, as in Godot.
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
