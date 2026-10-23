/**
 * Godot's manifold check on a CSG brush: weld the corners, then every edge needs faces that run
 * both ways along it. Each expectation is forced by the topology of a tetrahedron, not by our code.
 */

import { describe, expect, it } from 'vitest';
import { CSG_MERGE_TOLERANCE } from '../../../godot/scene/csg';
import { isClosedBrush, weldCorners } from './brushManifold';

type Point = readonly [number, number, number];
type Triangle = readonly [Point, Point, Point];

const ORIGIN: Point = [0, 0, 0];
const X: Point = [1, 0, 0];
const Y: Point = [0, 1, 0];
const Z: Point = [0, 0, 1];

/** The four faces of a tetrahedron, wound so each edge runs one way in one face and back in another. */
function tetrahedron(a: Point, b: Point, c: Point, d: Point): Triangle[] {
  return [
    [a, c, b],
    [a, b, d],
    [a, d, c],
    [b, c, d],
  ];
}

function weldsOf(triangles: readonly Triangle[]): Int32Array {
  return weldCorners(new Float32Array(triangles.flatMap((triangle) => triangle.flat())));
}

/** Move `point` along x, as a vertex that a mesh writes once per face drifts apart. */
function shifted(point: Point, dx: number): Point {
  return [point[0] + dx, point[1], point[2]];
}

describe('isClosedBrush', () => {
  it('closes a tetrahedron', () => {
    expect(isClosedBrush(weldsOf(tetrahedron(ORIGIN, X, Y, Z)))).toBe(true);
  });

  it('opens a tetrahedron with a face missing', () => {
    expect(isClosedBrush(weldsOf(tetrahedron(ORIGIN, X, Y, Z).slice(1)))).toBe(false);
  });

  it('closes a brush with no faces, which has no edge to leave open', () => {
    expect(isClosedBrush(weldsOf([]))).toBe(true);
  });

  it('welds two corners within the merge tolerance, which closes a brush split at one vertex', () => {
    const [first, ...rest] = tetrahedron(ORIGIN, X, Y, Z);
    const drifted: Triangle = [first![0], shifted(first![1], CSG_MERGE_TOLERANCE / 2), first![2]];

    expect(isClosedBrush(weldsOf([drifted, ...rest]))).toBe(true);
  });

  it('keeps two corners farther apart than the merge tolerance apart, which leaves the brush open', () => {
    const [first, ...rest] = tetrahedron(ORIGIN, X, Y, Z);
    const apart: Triangle = [first![0], shifted(first![1], CSG_MERGE_TOLERANCE * 4), first![2]];

    expect(isClosedBrush(weldsOf([apart, ...rest]))).toBe(false);
  });

  it('closes a brush wound the other way, since every edge still runs both ways', () => {
    const inverted = tetrahedron(ORIGIN, X, Y, Z).map(([a, b, c]): Triangle => [a, c, b]);

    expect(isClosedBrush(weldsOf(inverted))).toBe(true);
  });

  it('closes two solids that share one edge, where four faces meet', () => {
    const above = tetrahedron(ORIGIN, X, Y, Z);
    const below = tetrahedron(ORIGIN, X, [0, -1, 0], [0, 0, -1]);

    expect(isClosedBrush(weldsOf([...above, ...below]))).toBe(true);
  });

  it('opens a brush whose faces run the same way along one edge', () => {
    const [first, ...rest] = tetrahedron(ORIGIN, X, Y, Z);
    const [p, q, r] = first!;

    expect(isClosedBrush(weldsOf([[p, r, q], ...rest]))).toBe(false);
  });
});
