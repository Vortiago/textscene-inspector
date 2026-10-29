/**
 * The part of Godot's polypartition that `TextMesh` runs on a glyph: hole removal, Hertel-Mehlhorn
 * convex partition over an ear-clipping triangulation, and minimum-weight triangulation of each
 * convex piece. Each function returns null where polypartition returns 0, because the glyph that
 * fails there draws no face in Godot (`primitive_meshes.cpp:3185-3194`).
 *
 * Ported from `thirdparty/misc/polypartition.cpp` in Godot 4.6.3. It keeps the order of the
 * original's loops and the strictness of its comparisons, since both decide which glyph fails.
 *
 * Portions ported from Godot Engine (MIT), which ships polypartition.
 * Copyright (c) 2011-2021 Ivan Fratric and contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vector2 } from '../../../godot/math/vector';

/** A polygon, and whether it bounds a hole in the polygon that holds it. */
export interface PartitionPolygon {
  points: readonly Vector2[];
  isHole: boolean;
}

type Polygon = readonly Vector2[];
type Triangle = readonly [Vector2, Vector2, Vector2];

const turn = (p1: Vector2, p2: Vector2, p3: Vector2): number =>
  (p3.y - p1.y) * (p2.x - p1.x) - (p3.x - p1.x) * (p2.y - p1.y);

const isConvex = (p1: Vector2, p2: Vector2, p3: Vector2): boolean => turn(p1, p2, p3) > 0;

const isReflex = (p1: Vector2, p2: Vector2, p3: Vector2): boolean => turn(p1, p2, p3) < 0;

function isInside(p1: Vector2, p2: Vector2, p3: Vector2, p: Vector2): boolean {
  return !isConvex(p1, p, p2) && !isConvex(p2, p, p3) && !isConvex(p3, p, p1);
}

function inCone(p1: Vector2, p2: Vector2, p3: Vector2, p: Vector2): boolean {
  if (isConvex(p1, p2, p3)) return isConvex(p1, p2, p) && isConvex(p2, p3, p);
  return isConvex(p1, p2, p) || isConvex(p2, p3, p);
}

/** In double, as polypartition's `tppl_float` is, so it is not `normalizedVector2`, which rounds each step to single. */
function normalize({ x, y }: Vector2): Vector2 {
  const length = Math.sqrt(x * x + y * y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

const distance = (p1: Vector2, p2: Vector2): number => Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

const isSamePoint = (a: Vector2, b: Vector2): boolean => a.x === b.x && a.y === b.y;

const wrapped = (polygon: Polygon, index: number): Vector2 =>
  polygon[(index + polygon.length) % polygon.length]!;

/** Whether the segments cross. Segments that share an end point do not. */
function intersects(p11: Vector2, p12: Vector2, p21: Vector2, p22: Vector2): boolean {
  if (isSamePoint(p11, p21) || isSamePoint(p11, p22) || isSamePoint(p12, p21) || isSamePoint(p12, p22)) {
    return false;
  }
  const v1x = p12.y - p11.y;
  const v1y = p11.x - p12.x;
  const v2x = p22.y - p21.y;
  const v2y = p21.x - p22.x;

  const dot21 = (p21.x - p11.x) * v1x + (p21.y - p11.y) * v1y;
  const dot22 = (p22.x - p11.x) * v1x + (p22.y - p11.y) * v1y;
  const dot11 = (p11.x - p21.x) * v2x + (p11.y - p21.y) * v2y;
  const dot12 = (p12.x - p21.x) * v2x + (p12.y - p21.y) * v2y;
  return !(dot11 * dot12 > 0) && !(dot21 * dot22 > 0);
}

/** Whether the segment crosses an edge of `polygon`. */
function crossesEdge(from: Vector2, to: Vector2, polygon: Polygon): boolean {
  for (let k = 0; k < polygon.length; k++) {
    if (intersects(from, to, polygon[k]!, polygon[k + 1 === polygon.length ? 0 : k + 1]!)) return true;
  }
  return false;
}

/** The corner `index` of `polygon`. */
interface PolygonPoint {
  polygon: PartitionPolygon;
  index: number;
}

/** The first point with the largest x among the holes, or null for no hole. */
function rightmostHolePoint(polygons: readonly PartitionPolygon[]): PolygonPoint | null {
  let best: PolygonPoint | null = null;
  let bestX = -Infinity;
  for (const polygon of polygons) {
    if (!polygon.isHole) continue;
    for (let index = 0; index < polygon.points.length; index++) {
      const { x } = polygon.points[index]!;
      if (best === null || x > bestX) {
        best = { polygon, index };
        bestX = x;
      }
    }
  }
  return best;
}

function isVisibleFrom(holePoint: Vector2, point: Vector2, polygons: readonly PartitionPolygon[]): boolean {
  return polygons.every((other) => other.isHole || !crossesEdge(holePoint, point, other.points));
}

/**
 * The point right of `holePoint` that it sees, with the largest x in its normalised direction from
 * `holePoint`, the first of equals. Null where it sees none.
 */
function visiblePolygonPoint(polygons: readonly PartitionPolygon[], holePoint: Vector2): PolygonPoint | null {
  let best: PolygonPoint | null = null;
  let bestDirectionX = 0;
  for (const polygon of polygons) {
    if (polygon.isHole) continue;
    const { points } = polygon;
    for (let i = 0; i < points.length; i++) {
      const point = points[i]!;
      if (point.x <= holePoint.x) continue;
      if (!inCone(wrapped(points, i - 1), point, wrapped(points, i + 1), holePoint)) continue;
      const directionX = normalize({ x: point.x - holePoint.x, y: point.y - holePoint.y }).x;
      if (best && bestDirectionX > directionX) continue;
      if (isVisibleFrom(holePoint, point, polygons)) {
        best = { polygon, index: i };
        bestDirectionX = directionX;
      }
    }
  }
  return best;
}

/** The polygon with `hole` stitched in along the bridge from `bridge` to the hole's point `holeIndex`. */
function stitchHole(
  bridge: PolygonPoint,
  { polygon: hole, index: holeIndex }: PolygonPoint
): PartitionPolygon {
  const outer = bridge.polygon.points;
  const holePoints = hole.points;
  return {
    isHole: false,
    points: [
      ...outer.slice(0, bridge.index + 1),
      ...Array.from({ length: holePoints.length + 1 }, (_v, i) => wrapped(holePoints, i + holeIndex)),
      ...outer.slice(bridge.index),
    ],
  };
}

/** `TPPLPartition::RemoveHoles`: each hole merged into the polygon it sees, rightmost first. */
function removeHoles(inputs: readonly PartitionPolygon[]): Polygon[] | null {
  let polygons = inputs;
  for (let hole = rightmostHolePoint(polygons); hole; hole = rightmostHolePoint(polygons)) {
    const holePoint = hole.polygon.points[hole.index]!;
    const bridge = visiblePolygonPoint(polygons, holePoint);
    if (!bridge) return null;
    polygons = [
      ...polygons.filter((polygon) => polygon !== hole.polygon && polygon !== bridge.polygon),
      stitchHole(bridge, hole),
    ];
  }
  return polygons.map((polygon) => polygon.points);
}

interface EarVertex {
  point: Vector2;
  previous: number;
  next: number;
  isActive: boolean;
  isEar: boolean;
  angle: number;
}

/** The dot product of the unit directions from `from` to `a` and to `b`; a zero length gives a zero direction. */
function directionDot(from: Vector2, a: Vector2, b: Vector2): number {
  const aLength = Math.sqrt((a.x - from.x) ** 2 + (a.y - from.y) ** 2);
  const bLength = Math.sqrt((b.x - from.x) ** 2 + (b.y - from.y) ** 2);
  const ax = aLength === 0 ? 0 : (a.x - from.x) / aLength;
  const ay = aLength === 0 ? 0 : (a.y - from.y) / aLength;
  const bx = bLength === 0 ? 0 : (b.x - from.x) / bLength;
  const by = bLength === 0 ? 0 : (b.y - from.y) / bLength;
  return ax * bx + ay * by;
}

/** Whether no point of `vertices` but the corners of the triangle lies inside it, removed corners included. */
function isTriangleEmpty(
  vertices: readonly EarVertex[],
  before: Vector2,
  corner: Vector2,
  after: Vector2
): boolean {
  for (const { point } of vertices) {
    if (isSamePoint(point, corner) || isSamePoint(point, before) || isSamePoint(point, after)) continue;
    if (isInside(before, corner, after, point)) return false;
  }
  return true;
}

/** `TPPLPartition::UpdateVertex`. */
function updateEarVertex(vertices: EarVertex[], index: number): void {
  const vertex = vertices[index]!;
  const before = vertices[vertex.previous]!.point;
  const after = vertices[vertex.next]!.point;
  vertex.angle = directionDot(vertex.point, before, after);
  vertex.isEar =
    isConvex(before, vertex.point, after) && isTriangleEmpty(vertices, before, vertex.point, after);
}

function earVerticesOf(polygon: Polygon): EarVertex[] {
  const count = polygon.length;
  const vertices = polygon.map((point, i): EarVertex => ({
    point,
    previous: (i + count - 1) % count,
    next: (i + 1) % count,
    isActive: true,
    isEar: false,
    angle: 0,
  }));
  vertices.forEach((_vertex, i) => updateEarVertex(vertices, i));
  return vertices;
}

/** The active ear with the largest angle value, the first of equals, or -1 for none. */
function mostExtrudedEar(vertices: readonly EarVertex[]): number {
  let best = -1;
  vertices.forEach((vertex, i) => {
    if (vertex.isActive && vertex.isEar && (best < 0 || vertex.angle > vertices[best]!.angle)) best = i;
  });
  return best;
}

/** `TPPLPartition::Triangulate_EC`: clip the most extruded ear until a triangle is left. */
function triangulateByEars(polygon: Polygon): Triangle[] | null {
  if (polygon.length < 3) return null;
  if (polygon.length === 3) return [[polygon[0]!, polygon[1]!, polygon[2]!]];

  const vertices = earVerticesOf(polygon);
  const triangles: Triangle[] = [];
  for (let clipped = 0; clipped < polygon.length - 3; clipped++) {
    const earIndex = mostExtrudedEar(vertices);
    if (earIndex < 0) return null;
    const ear = vertices[earIndex]!;
    triangles.push([vertices[ear.previous]!.point, ear.point, vertices[ear.next]!.point]);
    ear.isActive = false;
    vertices[ear.previous]!.next = ear.next;
    vertices[ear.next]!.previous = ear.previous;
    if (clipped === polygon.length - 4) break;
    updateEarVertex(vertices, ear.previous);
    updateEarVertex(vertices, ear.next);
  }
  const last = vertices.find((vertex) => vertex.isActive)!;
  triangles.push([vertices[last.previous]!.point, last.point, vertices[last.next]!.point]);
  return triangles;
}

/** The union of two polygons across their shared edge, or null where the union has a reflex corner there. */
function mergeAcrossEdge(polygon: Polygon, other: Polygon, first: number, second: number): Vector2[] | null {
  const secondNext = (second + 1) % other.length;
  const firstNext = (first + 1) % polygon.length;
  if (!isConvex(wrapped(polygon, first - 1), polygon[first]!, wrapped(other, secondNext + 1))) return null;
  if (!isConvex(wrapped(other, second - 1), polygon[firstNext]!, wrapped(polygon, firstNext + 1)))
    return null;

  const merged: Vector2[] = [];
  for (let j = firstNext; j !== first; j = (j + 1) % polygon.length) merged.push(polygon[j]!);
  for (let j = secondNext; j !== second; j = (j + 1) % other.length) merged.push(other[j]!);
  return merged;
}

function hasReflexCorner(polygon: Polygon): boolean {
  return polygon.some((point, i) => isReflex(wrapped(polygon, i - 1), point, wrapped(polygon, i + 1)));
}

/** `TPPLPartition::ConvexPartition_HM` on one polygon: merge the ear-clipped triangles while they stay convex. */
function convexPartitionOne(polygon: Polygon): Polygon[] | null {
  if (polygon.length < 3) return null;
  if (!hasReflexCorner(polygon)) return [polygon];

  const pieces: Polygon[] | null = triangulateByEars(polygon);
  if (!pieces) return null;
  for (let a = 0; a < pieces.length; a++) {
    for (let i = 0; i < pieces[a]!.length; i++) {
      const merge = mergeWithLaterPiece(pieces, a, i);
      if (!merge) continue;
      pieces[a] = merge.polygon;
      pieces.splice(merge.otherIndex, 1);
      i = -1;
    }
  }
  return pieces;
}

/** The merge of piece `a` across its edge `edge` with the first later piece that shares the edge and stays convex. */
function mergeWithLaterPiece(
  pieces: readonly Polygon[],
  a: number,
  edge: number
): { polygon: Vector2[]; otherIndex: number } | null {
  const polygon = pieces[a]!;
  for (let b = a + 1; b < pieces.length; b++) {
    const second = sharedEdgeEnd(polygon, edge, pieces[b]!);
    if (second === null) continue;
    // The first later piece that has the edge decides, whether or not the merge keeps convexity.
    const polygonMerged = mergeAcrossEdge(polygon, pieces[b]!, edge, second);
    return polygonMerged && { polygon: polygonMerged, otherIndex: b };
  }
  return null;
}

/** The corner of `other` where the edge of `polygon` from corner `first` starts, run the other way, or null. */
function sharedEdgeEnd(polygon: Polygon, first: number, other: Polygon): number | null {
  const start = polygon[first]!;
  const end = wrapped(polygon, first + 1);
  for (let second = 0; second < other.length; second++) {
    if (isSamePoint(end, other[second]!) && isSamePoint(start, wrapped(other, second + 1))) {
      return second;
    }
  }
  return null;
}

/** `TPPLPartition::ConvexPartition_HM`: holes removed, then each polygon cut into convex pieces. */
export function convexPartition(inputs: readonly PartitionPolygon[]): Polygon[] | null {
  const polygons = removeHoles(inputs);
  if (!polygons) return null;
  const pieces: Polygon[] = [];
  for (const polygon of polygons) {
    const parts = convexPartitionOne(polygon);
    if (!parts) return null;
    pieces.push(...parts);
  }
  return pieces;
}

/**
 * The state of each pair of corners `(i, j)` with `i < j`, at index `j * count + i`: whether the pair
 * sees each other, the weight of the cheapest triangulation between them, and its apex.
 */
interface DiagonalStates {
  count: number;
  isVisible: Uint8Array;
  weight: Float64Array;
  bestVertex: Int32Array;
}

/** Whether the diagonal from corner `i` to corner `j` lies inside the polygon and crosses no edge. */
function isDiagonal(polygon: Polygon, i: number, j: number): boolean {
  const from = polygon[i]!;
  const to = polygon[j]!;
  return (
    inCone(wrapped(polygon, i - 1), from, wrapped(polygon, i + 1), to) &&
    inCone(wrapped(polygon, j - 1), to, wrapped(polygon, j + 1), from) &&
    !crossesEdge(from, to, polygon)
  );
}

function diagonalStates(polygon: Polygon): DiagonalStates {
  const count = polygon.length;
  const states: DiagonalStates = {
    count,
    isVisible: new Uint8Array(count * count).fill(1),
    weight: new Float64Array(count * count),
    bestVertex: new Int32Array(count * count).fill(-1),
  };
  for (let i = 0; i < count - 1; i++) {
    for (let j = i + 2; j < count; j++) {
      states.isVisible[j * count + i] = isDiagonal(polygon, i, j) ? 1 : 0;
    }
  }
  // The loop reaches the pair of the first and last corners, which are neighbours, not a diagonal.
  states.isVisible[(count - 1) * count] = 1;
  return states;
}

/** The distance between each pair of corners `(i, j)` with `i < j`, at index `j * count + i`. */
function cornerDistances(polygon: Polygon): Float64Array {
  const count = polygon.length;
  const distances = new Float64Array(count * count);
  for (let i = 0; i < count - 1; i++) {
    for (let j = i + 1; j < count; j++) distances[j * count + i] = distance(polygon[i]!, polygon[j]!);
  }
  return distances;
}

/** Fills the weight and apex of each pair with the cheapest apex between its corners; false where none is visible. */
function weighDiagonals(polygon: Polygon, states: DiagonalStates): boolean {
  const { count, isVisible, weight, bestVertex } = states;
  const distances = cornerDistances(polygon);
  for (let gap = 2; gap < count; gap++) {
    for (let i = 0; i < count - gap; i++) {
      const j = i + gap;
      if (!isVisible[j * count + i]) continue;
      let best = -1;
      let minWeight = 0;
      for (let k = i + 1; k < j; k++) {
        if (!isVisible[k * count + i] || !isVisible[j * count + k]) continue;
        const left = k <= i + 1 ? 0 : distances[k * count + i]!;
        const right = j <= k + 1 ? 0 : distances[j * count + k]!;
        const total = weight[k * count + i]! + weight[j * count + k]! + left + right;
        if (best === -1 || total < minWeight) {
          best = k;
          minWeight = total;
        }
      }
      if (best === -1) return false;
      bestVertex[j * count + i] = best;
      weight[j * count + i] = minWeight;
    }
  }
  return true;
}

/** `TPPLPartition::Triangulate_OPT`: the minimum-weight triangulation of a polygon, by dynamic programming. */
export function triangulateMinimumWeight(polygon: Polygon): Triangle[] | null {
  if (polygon.length < 3) return null;
  const states = diagonalStates(polygon);
  if (!weighDiagonals(polygon, states)) return null;

  const triangles: Triangle[] = [];
  const diagonals: [number, number][] = [[0, polygon.length - 1]];
  for (const [from, to] of diagonals) {
    const apex = states.bestVertex[to * states.count + from]!;
    if (apex === -1) return null;
    triangles.push([polygon[from]!, polygon[apex]!, polygon[to]!]);
    if (apex > from + 1) diagonals.push([from, apex]);
    if (to > apex + 1) diagonals.push([apex, to]);
  }
  return triangles;
}
