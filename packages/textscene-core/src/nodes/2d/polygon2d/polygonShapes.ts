/**
 * Turns a Polygon2D's raw arrays into the rings the renderer fills, in Godot's
 * +Y-down pixels. As in `polygon_2d.cpp` NOTIFICATION_DRAW: with no `polygons`, one
 * ring in stored order, less the trailing `internal_vertex_count` UV/skinning helpers.
 * With `invert`, that ring bridged to its grown bounds. Otherwise, one ring per
 * `polygons` entry.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { CMP_EPSILON } from '../../../godot/math/math';
import type { Rect2 } from '../../../godot/math/rect2';
import { storedReal as f } from '../../../godot/math/real';
import type { Vector2 } from '../../../godot/math/vector';

export interface PolygonRings {
  /**
   * The vertex pool every ring indexes into: `polygon` in authored order, or the bridged ring
   * `invert_enabled` builds. Rings are indices so `uv` and `vertex_colors`, which Godot pairs with
   * points by position, stay aligned.
   */
  points: Vector2[];
  /** Filled outlines. One per `polygons` entry, or a single stored-order ring. */
  outlines: number[][];
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
  if (all.length < MIN_RING) return { points: all, outlines: [] };
  const allIndices = all.map((_, i) => i);

  if (invertEnabled) {
    // Invert ignores `polygons` but still trims, and draws any ring left (`polygon_2d.cpp:153-160`).
    const ring = trimInternal(allIndices, all.length, internalVertexCount).map((i) => all[i]!);
    if (ring.length === 0) return { points: all, outlines: [] };
    const points = invertedRing(ring, f(invertBorder));
    return { points, outlines: [points.map((_, i) => i)] };
  }

  if (polygons.length > 0) {
    const outlines = polygons
      .filter((indices) => indices.length >= MIN_RING)
      .map((indices) => indices.filter((i) => all[i] !== undefined))
      .filter((ring) => ring.length >= MIN_RING);
    return { points: all, outlines };
  }

  const outline = trimInternal(allIndices, all.length, internalVertexCount);
  return { points: all, outlines: outline.length >= MIN_RING ? [outline] : [] };
}

/**
 * The one ring `invert_enabled` fills (`polygon_2d.cpp:170-218`): seven points after the lowest
 * vertex bridge the polygon to the bounds grown by `border`, so the polygon reads as a hole. A ring
 * wound the other way takes the bridge mirrored, so the outline keeps one winding. The bridge
 * returns `CMP_EPSILON` left of the lowest vertex.
 */
function invertedRing(ring: Vector2[], border: number): Vector2[] {
  const lowest = lowestIndex(ring);
  const bounds = grownBounds(ring, border);
  const right = f(bounds.x + bounds.w);
  const bottom = f(bounds.y + bounds.h);
  const bridgeX = f(ring[lowest]!.x - CMP_EPSILON);
  const bridgeY = f(ring[lowest]!.y + border);
  const bridge: Vector2[] = [
    { x: ring[lowest]!.x, y: bridgeY },
    { x: right, y: bottom },
    { x: right, y: bounds.y },
    { x: bounds.x, y: bounds.y },
    { x: bounds.x, y: bottom },
    { x: bridgeX, y: bridgeY },
    { x: bridgeX, y: ring[lowest]!.y },
  ];
  const points = [...ring];
  if (shoelaceSum(ring) > 0) {
    [bridge[1], bridge[4]] = [bridge[4]!, bridge[1]!];
    [bridge[2], bridge[3]] = [bridge[3]!, bridge[2]!];
    [bridge[5], bridge[0]] = [bridge[0]!, bridge[5]!];
    [bridge[6], points[lowest]] = [points[lowest]!, bridge[6]!];
  }
  points.splice(lowest + 1, 0, ...bridge);
  return points;
}

/** The first vertex with the largest y, the lowest on screen. */
function lowestIndex(ring: Vector2[]): number {
  let lowest = 0;
  for (let i = 1; i < ring.length; i++) if (ring[i]!.y > ring[lowest]!.y) lowest = i;
  return lowest;
}

/** `sum` in `polygon_2d.cpp:184-185`, in float32: positive for one winding, negative for the other. */
function shoelaceSum(ring: Vector2[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const next = ring[(i + 1) % ring.length]!;
    sum = f(sum + f(f(next.x - ring[i]!.x) * f(next.y + ring[i]!.y)));
  }
  return sum;
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

/** The ring's bounds after `Rect2::grow(border)`, in float32 as `real_t` holds them. */
function grownBounds(ring: Vector2[], border: number): Rect2 {
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
  return {
    x: f(minX - border),
    y: f(minY - border),
    w: f(f(maxX - minX) + f(border * 2)),
    h: f(f(maxY - minY) + f(border * 2)),
  };
}
