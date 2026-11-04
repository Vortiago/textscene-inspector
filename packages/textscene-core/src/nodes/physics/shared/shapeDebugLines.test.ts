/**
 * `shapeDebugLines`: Godot's `Shape3D::get_debug_mesh_lines()` per decoded type, in the float ops
 * the shape code runs (`scene/resources/3d/*.cpp`), with the box edges in Godot's `AABB::get_edge`
 * order and the concave pairs per the canonical `DrawEdge` (concave_polygon_shape_3d.h:54-59).
 */
import { describe, expect, it } from 'vitest';
import { shapeDebugLines } from './shapeDebugLines';
import { godotDebugLinesFor, undirectedEdges } from './godotDebugLines.testkit';
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

/** Every shape type measured against Godot 4.6.3 through `get_debug_mesh()`. */
describe.each([
  'BoxShape3D',
  'SphereShape3D',
  'CylinderShape3D',
  'CapsuleShape3D',
  'WorldBoundaryShape3D',
  'SeparationRayShape3D',
])('%s debug lines', (type) => {
  it.each(godotDebugLinesFor(type))('match Godot for $name', ({ shape, lines }) => {
    const wire = shapeDebugLines(shape)!;
    expect(wire).toHaveLength(lines.length);
    lines.forEach((value, index) => expect(wire[index]).toBeCloseTo(value, 4));
  });
});

describe('ConcavePolygonShape3D debug lines', () => {
  it.each(godotDebugLinesFor('ConcavePolygonShape3D'))('match Godot for $name', ({ shape, lines }) => {
    expect(undirectedEdges(shapeDebugLines(shape)!)).toEqual(undirectedEdges(lines));
  });
});
