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

const isConvex = (p1: Vector2, p2: Vector2, p3: Vector2): boolean =>
  (p3.y - p1.y) * (p2.x - p1.x) - (p3.x - p1.x) * (p2.y - p1.y) > 0;

const isReflex = (p1: Vector2, p2: Vector2, p3: Vector2): boolean =>
  (p3.y - p1.y) * (p2.x - p1.x) - (p3.x - p1.x) * (p2.y - p1.y) < 0;

function isInside(p1: Vector2, p2: Vector2, p3: Vector2, p: Vector2): boolean {
  return !isConvex(p1, p, p2) && !isConvex(p2, p, p3) && !isConvex(p3, p, p1);
}

function inCone(p1: Vector2, p2: Vector2, p3: Vector2, p: Vector2): boolean {
  if (isConvex(p1, p2, p3)) return isConvex(p1, p2, p) && isConvex(p2, p3, p);
  return isConvex(p1, p2, p) || isConvex(p2, p3, p);
}

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
  const v1ort = { x: p12.y - p11.y, y: p11.x - p12.x };
  const v2ort = { x: p22.y - p21.y, y: p21.x - p22.x };
  const dotWith = (ort: Vector2, from: Vector2, to: Vector2) =>
    (to.x - from.x) * ort.x + (to.y - from.y) * ort.y;

  const dot21 = dotWith(v1ort, p11, p21);
  const dot22 = dotWith(v1ort, p11, p22);
  const dot11 = dotWith(v2ort, p21, p11);
  const dot12 = dotWith(v2ort, p21, p12);
  return !(dot11 * dot12 > 0) && !(dot21 * dot22 > 0);
}

interface HolePoint {
  hole: PartitionPolygon;
  index: number;
}

/** The first point with the largest x among the holes, or null for no hole. */
function rightmostHolePoint(polygons: readonly PartitionPolygon[]): HolePoint | null {
  let best: HolePoint | null = null;
  let bestX = -Infinity;
  for (const hole of polygons) {
    if (!hole.isHole) continue;
    for (let index = 0; index < hole.points.length; index++) {
      const { x } = hole.points[index]!;
      if (best === null || x > bestX) {
        best = { hole, index };
        bestX = x;
      }
    }
  }
  return best;
}

interface BridgePoint {
  polygon: PartitionPolygon;
  index: number;
}

function isVisibleFrom(holePoint: Vector2, point: Vector2, polygons: readonly PartitionPolygon[]): boolean {
  return polygons.every(
    (other) =>
      other.isHole ||
      other.points.every((from, i) => !intersects(holePoint, point, from, wrapped(other.points, i + 1)))
  );
}

/** The point right of `holePoint` that it sees, and that lies leftmost-first by direction, or null. */
function visiblePolygonPoint(polygons: readonly PartitionPolygon[], holePoint: Vector2): BridgePoint | null {
  let best: BridgePoint | null = null;
  for (const polygon of polygons) {
    if (polygon.isHole) continue;
    const { points } = polygon;
    for (let i = 0; i < points.length; i++) {
      const point = points[i]!;
      if (point.x <= holePoint.x) continue;
      if (!inCone(wrapped(points, i - 1), point, wrapped(points, i + 1), holePoint)) continue;
      if (best) {
        const toPoint = normalize({ x: point.x - holePoint.x, y: point.y - holePoint.y });
        const toBest = normalize({
          x: best.polygon.points[best.index]!.x - holePoint.x,
          y: best.polygon.points[best.index]!.y - holePoint.y,
        });
        if (toBest.x > toPoint.x) continue;
      }
      if (isVisibleFrom(holePoint, point, polygons)) best = { polygon, index: i };
    }
  }
  return best;
}

/** The polygon with `hole` stitched in along the bridge from `bridge` to the hole's point `holeIndex`. */
function stitchHole(bridge: BridgePoint, { hole, index: holeIndex }: HolePoint): PartitionPolygon {
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
    const holePoint = hole.hole.points[hole.index]!;
    const bridge = visiblePolygonPoint(polygons, holePoint);
    if (!bridge) return null;
    polygons = [
      ...polygons.filter((polygon) => polygon !== hole.hole && polygon !== bridge.polygon),
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

/** `TPPLPartition::UpdateVertex`. An ear has no vertex of the polygon inside it, removed corners included. */
function updateEarVertex(vertices: EarVertex[], index: number): void {
  const vertex = vertices[index]!;
  const before = vertices[vertex.previous]!.point;
  const after = vertices[vertex.next]!.point;
  const toBefore = normalize({ x: before.x - vertex.point.x, y: before.y - vertex.point.y });
  const toAfter = normalize({ x: after.x - vertex.point.x, y: after.y - vertex.point.y });
  vertex.angle = toBefore.x * toAfter.x + toBefore.y * toAfter.y;
  vertex.isEar =
    isConvex(before, vertex.point, after) &&
    vertices.every(
      ({ point }) =>
        isSamePoint(point, vertex.point) ||
        isSamePoint(point, before) ||
        isSamePoint(point, after) ||
        !isInside(before, vertex.point, after, point)
    );
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

interface SharedEdge {
  /** The index of the first end of the edge in the first polygon, the edge running to the next point. */
  first: number;
  /** The same for the second polygon, where the edge runs the other way. */
  second: number;
}

/** The union of two polygons across their shared edge, or null where the union has a reflex corner there. */
function mergeAcrossEdge(polygon: Polygon, other: Polygon, { first, second }: SharedEdge): Vector2[] | null {
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

  const triangles = triangulateByEars(polygon);
  if (!triangles) return null;
  const pieces: Polygon[] = triangles;
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
    const shared = sharedEdgeAt(polygon, edge, pieces[b]!);
    if (!shared) continue;
    // The first later piece that has the edge decides, whether or not the merge keeps convexity.
    const polygonMerged = mergeAcrossEdge(polygon, pieces[b]!, shared);
    return polygonMerged && { polygon: polygonMerged, otherIndex: b };
  }
  return null;
}

/** The shared edge that starts at corner `first` of `polygon`, or null. */
function sharedEdgeAt(polygon: Polygon, first: number, other: Polygon): SharedEdge | null {
  const start = polygon[first]!;
  const end = wrapped(polygon, first + 1);
  for (let second = 0; second < other.length; second++) {
    if (isSamePoint(end, other[second]!) && isSamePoint(start, wrapped(other, second + 1))) {
      return { first, second };
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

interface DiagonalState {
  isVisible: boolean;
  weight: number;
  bestVertex: number;
}

/** Whether the diagonal from corner `i` to corner `j` lies inside the polygon and crosses no edge. */
function isDiagonal(polygon: Polygon, i: number, j: number): boolean {
  const from = polygon[i]!;
  const to = polygon[j]!;
  return (
    inCone(wrapped(polygon, i - 1), from, wrapped(polygon, i + 1), to) &&
    inCone(wrapped(polygon, j - 1), to, wrapped(polygon, j + 1), from) &&
    polygon.every((start, k) => !intersects(from, to, start, wrapped(polygon, k + 1)))
  );
}

function diagonalStates(polygon: Polygon): DiagonalState[][] {
  const count = polygon.length;
  // `states[j][i]` for i < j.
  const states = Array.from({ length: count }, () =>
    Array.from({ length: count }, (): DiagonalState => ({ isVisible: true, weight: 0, bestVertex: -1 }))
  );
  for (let i = 0; i < count - 1; i++) {
    for (let j = i + 2; j < count; j++) {
      states[j]![i]!.isVisible = isDiagonal(polygon, i, j);
    }
  }
  // The first and last corners are neighbours, not a diagonal.
  states[count - 1]![0]!.isVisible = true;
  return states;
}

/** Fills `states[j][i]` with the cheapest apex between corners `i` and `j`; false where none is visible. */
function weighDiagonals(polygon: Polygon, states: DiagonalState[][]): boolean {
  const count = polygon.length;
  for (let gap = 2; gap < count; gap++) {
    for (let i = 0; i < count - gap; i++) {
      const j = i + gap;
      if (!states[j]![i]!.isVisible) continue;
      let bestVertex = -1;
      let minWeight = 0;
      for (let k = i + 1; k < j; k++) {
        if (!states[k]![i]!.isVisible || !states[j]![k]!.isVisible) continue;
        const left = k <= i + 1 ? 0 : distance(polygon[i]!, polygon[k]!);
        const right = j <= k + 1 ? 0 : distance(polygon[k]!, polygon[j]!);
        const weight = states[k]![i]!.weight + states[j]![k]!.weight + left + right;
        if (bestVertex === -1 || weight < minWeight) {
          bestVertex = k;
          minWeight = weight;
        }
      }
      if (bestVertex === -1) return false;
      states[j]![i]!.bestVertex = bestVertex;
      states[j]![i]!.weight = minWeight;
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
  for (let diagonal = diagonals.shift(); diagonal; diagonal = diagonals.shift()) {
    const [from, to] = diagonal;
    const apex = states[to]![from]!.bestVertex;
    if (apex === -1) return null;
    triangles.push([polygon[from]!, polygon[apex]!, polygon[to]!]);
    if (apex > from + 1) diagonals.push([from, apex]);
    if (to > apex + 1) diagonals.push([apex, to]);
  }
  return triangles;
}
