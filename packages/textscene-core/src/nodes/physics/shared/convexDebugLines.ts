/**
 * The hull edges `ConvexPolygonShape3D::get_debug_mesh_lines` draws (`convex_polygon_shape_3d.cpp:36-56`):
 * one segment per edge of the hull's polygon faces. A hull builder triangulates those faces, so an
 * edge between coplanar triangles is not an edge of the hull and is not drawn.
 */

import * as THREE from 'three';
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

function tuple({ x, y, z }: Vector3): [number, number, number] {
  return [x, y, z];
}

/** The offsets of every point from the first along `direction`, or null when one leaves the line. */
function offsetsAlong(points: Float32Array, origin: Vector3, direction: Vector3): number[] | null {
  const lengthSquared = vector3Dot(tuple(direction), tuple(direction));
  const offsets: number[] = [];
  for (let index = 0; index < points.length / FLOATS_PER_VERTEX; index += 1) {
    const offset = tuple(vector3Sub(vertexAt(points, index), origin));
    const off = vector3Cross(offset, tuple(direction));
    if (Math.hypot(...off) > COLLINEAR_TOLERANCE * lengthSquared) return null;
    offsets.push(vector3Dot(offset, tuple(direction)) / lengthSquared);
  }
  return offsets;
}

/**
 * The two ends of a line of collinear points, or null when the points leave the line. The points
 * are distinct, so the line has a direction.
 */
function lineEnds(points: Float32Array): [Vector3, Vector3] | null {
  const origin = vertexAt(points, 0);
  const direction = vector3Sub(farthestFromFirst(points), origin);
  const offsets = offsetsAlong(points, origin, direction);
  if (!offsets) return null;
  const at = (along: number): Vector3 => ({
    x: origin.x + direction.x * along,
    y: origin.y + direction.y * along,
    z: origin.z + direction.z * along,
  });
  return [at(Math.min(0, ...offsets)), at(Math.max(0, ...offsets))];
}

function triangleSides(points: Float32Array): Float32Array {
  const sides = [0, 1, 1, 2, 2, 0].flatMap((corner) => tuple(vertexAt(points, corner)));
  return Float32Array.from(sides);
}

/**
 * Godot draws a hull of collinear points as the line between the ends, and of three other points
 * as their triangle. A volume hull builder returns no triangles for either.
 */
function degenerateHullLines(points: Float32Array): Float32Array {
  const count = points.length / FLOATS_PER_VERTEX;
  if (count < 2) return new Float32Array(0);
  const ends = lineEnds(points);
  if (ends) return Float32Array.from(ends.flatMap(tuple));
  return count === 3 ? triangleSides(points) : new Float32Array(0);
}

/** The finite points once each: a builder throws on a repeated or non-finite point. */
function distinctFinitePoints(points: Float32Array): Float32Array {
  const seen = new Set<string>();
  const kept: number[] = [];
  for (let index = 0; index < points.length / FLOATS_PER_VERTEX; index += 1) {
    const point = tuple(vertexAt(points, index));
    const key = point.join(',');
    if (!point.every(Number.isFinite) || seen.has(key)) continue;
    seen.add(key);
    kept.push(...point);
  }
  return Float32Array.from(kept);
}

/** Builds the hull of `points` as flat non-indexed triangles, which is what three's ConvexGeometry gives. */
export type HullBuilder = new (points: THREE.Vector3[]) => THREE.BufferGeometry;

/** The hull's triangles, or none for the points three's builder throws on: a line, or a flat cloud of three. */
function hullTriangles(points: Float32Array, Builder: HullBuilder): ArrayLike<number> {
  const vectors: THREE.Vector3[] = [];
  for (let index = 0; index < points.length / FLOATS_PER_VERTEX; index += 1) {
    vectors.push(new THREE.Vector3(...tuple(vertexAt(points, index))));
  }
  try {
    const hull = new Builder(vectors);
    const triangles = hull.getAttribute('position').array;
    hull.dispose();
    return triangles;
  } catch {
    // The builder reads a missing face on a cloud with no volume and no plane.
    return [];
  }
}

/** The segments of the convex hull of `points`, built through `Builder`. Empty for fewer than two points. */
export function convexDebugLines(points: Float32Array, Builder: HullBuilder): Float32Array {
  const distinct = distinctFinitePoints(points);
  const triangles = hullTriangles(distinct, Builder);
  return triangles.length >= FLOATS_PER_TRIANGLE ? solidHullLines(triangles) : degenerateHullLines(distinct);
}
