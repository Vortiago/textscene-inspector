/**
 * The hull edges `ConvexPolygonShape3D::get_debug_mesh_lines` draws (`convex_polygon_shape_3d.cpp:36-56`):
 * one segment per edge of the hull's polygon faces. A hull builder triangulates those faces, so an
 * edge between coplanar triangles is not an edge of the hull and is not drawn.
 */

import {
  FLOATS_PER_VERTEX,
  normalizedVector3,
  vector3Cross,
  vector3Dot,
  vector3Sub,
  type Vector3,
} from '../../../godot/math/vector.js';

/**
 * Two triangle normals with a dot product above this are one face: the angle between them is
 * under 0.1 degrees, which float rounding in a coplanar triangulation stays within.
 */
const COPLANAR_NORMAL_DOT = 1 - 1e-6;

const FLOATS_PER_TRIANGLE = 3 * FLOATS_PER_VERTEX;

/** The share of a line's length the other points may stray from it and still count as collinear. */
const COLLINEAR_TOLERANCE = 1e-5;

interface HullEdge {
  start: readonly number[];
  end: readonly number[];
  normals: Array<[number, number, number]>;
}

function vertexAt(array: ArrayLike<number>, index: number): Vector3 {
  const at = index * FLOATS_PER_VERTEX;
  return { x: array[at]!, y: array[at + 1]!, z: array[at + 2]! };
}

function triangleNormal(a: Vector3, b: Vector3, c: Vector3): [number, number, number] {
  const cross = vector3Cross([b.x - a.x, b.y - a.y, b.z - a.z], [c.x - a.x, c.y - a.y, c.z - a.z]);
  return normalizedVector3(...cross);
}

/** One entry per undirected edge, holding the normal of each triangle that has it. */
function edgesOfTriangles(triangles: ArrayLike<number>): Map<string, HullEdge> {
  const edges = new Map<string, HullEdge>();
  for (let first = 0; first + FLOATS_PER_TRIANGLE <= triangles.length; first += FLOATS_PER_TRIANGLE) {
    const corners = [0, 1, 2].map((corner) => vertexAt(triangles, first / FLOATS_PER_VERTEX + corner));
    const normal = triangleNormal(corners[0]!, corners[1]!, corners[2]!);
    for (let corner = 0; corner < 3; corner += 1) {
      const start = corners[corner]!;
      const end = corners[(corner + 1) % 3]!;
      const key = [start, end]
        .map(({ x, y, z }) => `${x},${y},${z}`)
        .sort()
        .join('|');
      const edge = edges.get(key) ?? {
        start: [start.x, start.y, start.z],
        end: [end.x, end.y, end.z],
        normals: [],
      };
      edge.normals.push(normal);
      edges.set(key, edge);
    }
  }
  return edges;
}

/**
 * A hull edge has two triangles on it. Two in one plane make a face interior; two facing opposite
 * ways are the rim of a flat hull, which the builder doubles; a flat hull's diagonal has four.
 */
function isHullEdge({ normals }: HullEdge): boolean {
  return normals.length === 2 && vector3Dot(normals[0]!, normals[1]!) < COPLANAR_NORMAL_DOT;
}

function solidHullLines(triangles: ArrayLike<number>): Float32Array {
  const lines: number[] = [];
  for (const edge of edgesOfTriangles(triangles).values()) {
    if (isHullEdge(edge)) lines.push(...edge.start, ...edge.end);
  }
  return Float32Array.from(lines);
}

/** The farthest point from the first, which is an end of the line when the points are collinear. */
function farthestFromFirst(points: Float32Array): Vector3 {
  const origin = vertexAt(points, 0);
  let farthest = origin;
  let farthestDistance = 0;
  for (let index = 1; index < points.length / FLOATS_PER_VERTEX; index += 1) {
    const point = vertexAt(points, index);
    const { x, y, z } = vector3Sub(point, origin);
    const distance = x * x + y * y + z * z;
    if (distance > farthestDistance) [farthest, farthestDistance] = [point, distance];
  }
  return farthest;
}

/** The two ends of a line of collinear points, or null when the points leave the line. */
function lineEnds(points: Float32Array): [Vector3, Vector3] | null {
  const origin = vertexAt(points, 0);
  const far = farthestFromFirst(points);
  const direction = vector3Sub(far, origin);
  const length = Math.hypot(direction.x, direction.y, direction.z);
  let [low, high] = [0, 0];
  for (let index = 0; index < points.length / FLOATS_PER_VERTEX; index += 1) {
    const offset = vector3Sub(vertexAt(points, index), origin);
    const off = vector3Cross([offset.x, offset.y, offset.z], [direction.x, direction.y, direction.z]);
    if (Math.hypot(...off) > COLLINEAR_TOLERANCE * length * length) return null;
    const along = vector3Dot([offset.x, offset.y, offset.z], [direction.x, direction.y, direction.z]);
    [low, high] = [Math.min(low, along), Math.max(high, along)];
  }
  const at = (along: number): Vector3 => ({
    x: origin.x + (direction.x * along) / (length * length),
    y: origin.y + (direction.y * along) / (length * length),
    z: origin.z + (direction.z * along) / (length * length),
  });
  return [at(low), at(high)];
}

/**
 * Godot draws a hull of two collinear points or three non-collinear ones, which a triangle hull
 * builder returns nothing for: the line between the ends, or the triangle's three sides.
 */
function degenerateHullLines(points: Float32Array): Float32Array {
  const count = points.length / FLOATS_PER_VERTEX;
  if (count < 2) return new Float32Array(0);
  const ends = lineEnds(points);
  if (ends) return Float32Array.from(ends.flatMap(({ x, y, z }) => [x, y, z]));
  if (count !== 3) return new Float32Array(0);
  return Float32Array.from(
    [0, 1, 1, 2, 2, 0].flatMap((index) => Array.from(points.subarray(index * 3, index * 3 + 3)))
  );
}

/**
 * The segments of the convex hull of `points`. `hullTriangles` are the hull's triangles as flat
 * non-indexed positions, from a builder that returns none for fewer than four points or a line.
 */
export function convexDebugLines(points: Float32Array, hullTriangles: ArrayLike<number>): Float32Array {
  return hullTriangles.length >= FLOATS_PER_TRIANGLE
    ? solidHullLines(hullTriangles)
    : degenerateHullLines(points);
}
