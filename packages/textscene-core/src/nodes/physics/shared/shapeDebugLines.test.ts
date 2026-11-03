/**
 * `shapeDebugLines`: Godot's `Shape3D::get_debug_mesh_lines()` per decoded type, in the float ops
 * the shape code runs (`scene/resources/3d/*.cpp`), with the box edges in Godot's `AABB::get_edge`
 * order and the concave pairs per the canonical `DrawEdge` (concave_polygon_shape_3d.h:54-59).
 */
import { describe, expect, it } from 'vitest';
import { shapeDebugLines } from './shapeDebugLines';
import { degToRadf } from '../../../godot/math/math.js';
import type { TscnInternalResource } from '../../../parser/types';

const sphere: TscnInternalResource = { id: 'a', type: 'SphereShape3D', data: { radius: '2' } };
const cylinder: TscnInternalResource = {
  id: 'a',
  type: 'CylinderShape3D',
  data: { radius: '1', height: '2' },
};
const capsule: TscnInternalResource = { id: 'a', type: 'CapsuleShape3D', data: { radius: '1', height: '4' } };

describe('boxDebugLines', () => {
  /** Godot's AABB edge order (aabb.cpp:357-416) read from `-size/2`. */
  const firstFourEdges = [
    [0.5, -0.5, -0.5, -0.5, -0.5, -0.5],
    [0.5, -0.5, 0.5, 0.5, -0.5, -0.5],
    [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5],
    [-0.5, -0.5, -0.5, -0.5, -0.5, 0.5],
  ];

  it('writes the 12 edges in index order', () => {
    const wire = shapeDebugLines({ id: 'a', type: 'BoxShape3D', data: { size: 'Vector3(1, 1, 1)' } })!;
    expect(wire.length).toBe(12 * 6);
    for (let i = 0; i < firstFourEdges.length; i += 1) {
      expect(Array.from(wire.slice(i * 6, i * 6 + 6))).toEqual(firstFourEdges[i]);
    }
  });

  it('scales the corners by a non-cubic size, from -size/2', () => {
    const wire = shapeDebugLines({ id: 'a', type: 'BoxShape3D', data: { size: 'Vector3(2, 0.5, 1)' } })!;
    expect(Array.from(wire.slice(0, 3))).toEqual([1, -0.25, -0.5]);
  });
});

describe('shapeDebugLines', () => {
  it('writes the circle counts Godot loops', () => {
    expect(shapeDebugLines(sphere)!.length).toBe(361 * 3 * 6);
    expect(shapeDebugLines(cylinder)!.length).toBe(724 * 6);
    expect(shapeDebugLines(capsule)!.length).toBe(1444 * 6);
  });

  it('reads a sphere from its decode', () => {
    const wire = shapeDebugLines(sphere)!;
    // The equator ring's first segment, radius 2: 0 on x, 2 on z, a degree step apart.
    const expected = [0, 0, 2, 2 * Math.sin(degToRadf(1)), 0, 2 * Math.cos(degToRadf(1))];
    expect(wire.length).toBe(361 * 3 * 6);
    for (const [i, value] of expected.entries()) expect(wire[i]).toBeCloseTo(value, 7);
  });

  it('gives null for a type without a port, which the caller warns about', () => {
    expect(shapeDebugLines({ id: 'a', type: 'SegmentShape2D', data: {} })).toBeNull();
  });

  it('dedups a concave soup to one pair per canonical edge', () => {
    // Two triangles, ABC and BAF, winding the shared AB edge opposite ways: 10 vertices, not 12.
    const wire = shapeDebugLines({
      id: 'a',
      type: 'ConcavePolygonShape3D',
      data: {
        data: 'PackedVector3Array(-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 0, 1)',
      },
    })!;
    expect(wire.length).toBe(10 * 3);
    // The three edges of the first triangle, Godot's DrawEdge direction: the larger vertex leads.
    expect(Array.from(wire.slice(0, 18))).toEqual([
      0.5, 0, -0.5, -0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0, 0.5, 0, 0, 0.5, -0.5, 0, -0.5,
    ]);
  });

  it('pins a default-size box to 12 edges', () => {
    expect(shapeDebugLines({ id: 'a', type: 'BoxShape3D', data: {} })!.length).toBe(12 * 6);
  });
});

/** Plane `[nx, ny, nz, d]` and the 10 vertices (5 segments) Godot draws for it. */
const GODOT_WORLD_BOUNDARY_LINES: readonly (readonly [string, number[], number[]])[] = [
  [
    'the default plane',
    [0, 1, 0, 0],
    [
      10, 0, -10, 10, 0, 10, 10, 0, 10, -10, 0, 10, -10, 0, 10, -10, 0, -10, -10, 0, -10, 10, 0, -10, 0, 0, 0,
      0, 3, 0,
    ],
  ],
  [
    'an x normal with an offset',
    [1, 0, 0, 2.5],
    [
      2.5, 10, 10, 2.5, 10, -10, 2.5, 10, -10, 2.5, -10, -10, 2.5, -10, -10, 2.5, -10, 10, 2.5, -10, 10, 2.5,
      10, 10, 2.5, 0, 0, 5.5, 0, 0,
    ],
  ],
  [
    'a non-unit normal',
    [0, 2, 0, -1],
    [
      10, -2, -10, 10, -2, 10, 10, -2, 10, -10, -2, 10, -10, -2, 10, -10, -2, -10, -10, -2, -10, 10, -2, -10,
      0, -2, 0, 0, 4, 0,
    ],
  ],
  [
    'a tilted unit normal',
    [0.6, 0.8, 0, 1.5],
    [
      8.9, -4.8, -10, 8.9, -4.8, 10, 8.9, -4.8, 10, -7.1, 7.2, 10, -7.1, 7.2, 10, -7.1, 7.2, -10, -7.1, 7.2,
      -10, 8.9, -4.8, -10, 0.9, 1.2, 0, 2.7, 3.6, 0,
    ],
  ],
  [
    'a unit normal with three components',
    [0.2, 0.3, -0.9, 0.7],
    [
      9.95023, -9.88997, -1.95286, 9.95023, 9.08369, 4.3717, 9.95023, 9.08369, 4.3717, -9.67023, 10.31,
      0.69286, -9.67023, 10.31, 0.69286, -9.67023, -8.66369, -5.6317, -9.67023, -8.66369, -5.6317, 9.95023,
      -9.88997, -1.95286, 0.14, 0.21, -0.63, 0.74, 1.11, -3.33,
    ],
  ],
  [
    'a normal near the x axis (the other perpendicular seed)',
    [0.995, 0.1, 0, 1],
    [
      -0.00501, 10.0499, 10, -0.00501, 10.0499, -10, -0.00501, 10.0499, -10, 1.99501, -9.84987, -10, 1.99501,
      -9.84987, -10, 1.99501, -9.84987, 10, 1.99501, -9.84987, 10, -0.00501, 10.0499, 10, 0.995, 0.1, 0, 3.98,
      0.4, 0,
    ],
  ],
  [
    'a zero normal, which Godot normalises to zero rather than NaN',
    [0, 0, 0, 5],
    [10, 0, 0, 10, 0, 0, 10, 0, 0, -10, 0, 0, -10, 0, 0, -10, 0, 0, -10, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
];

/** Nine planes measured against Godot 4.6.3: `get_debug_mesh()` read back after `plane` is set. */
describe('worldBoundaryDebugLines', () => {
  it.each(GODOT_WORLD_BOUNDARY_LINES)('matches Godot for %s', (_name, [nx, ny, nz, d], expected) => {
    const wire = shapeDebugLines({
      id: 'a',
      type: 'WorldBoundaryShape3D',
      data: { plane: `Plane(${nx}, ${ny}, ${nz}, ${d})` },
    })!;
    expect(wire).toHaveLength(expected.length);
    expected.forEach((value, index) => expect(wire[index]).toBeCloseTo(value, 4));
  });
});
