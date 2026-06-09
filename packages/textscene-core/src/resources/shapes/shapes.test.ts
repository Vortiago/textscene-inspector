import { describe, expect, it } from 'vitest';
import { parseBoxShape3D } from './boxshape3d/parser';
import { parseConvexPolygonShape3D } from './convexpolygonshape3d/parser';
import { parseConcavePolygonShape3D } from './concavepolygonshape3d/parser';
import { parsePackedVector3Array } from './packedArray';

describe('parsePackedVector3Array', () => {
  it('parses a flat list of vertices', () => {
    const arr = parsePackedVector3Array('PackedVector3Array(1, 2, 3, 4, 5, 6)');
    expect(Array.from(arr)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns empty for an empty array', () => {
    expect(parsePackedVector3Array('PackedVector3Array()').length).toBe(0);
  });

  it('throws on malformed input', () => {
    expect(() => parsePackedVector3Array('not-an-array')).toThrow();
  });
});

describe('parseBoxShape3D', () => {
  it('parses size from Vector3', () => {
    expect(parseBoxShape3D({ size: 'Vector3(2, 4, 0.3)' }).size).toEqual({ x: 2, y: 4, z: 0.3 });
  });

  it('defaults to Vector3(1,1,1)', () => {
    expect(parseBoxShape3D({}).size).toEqual({ x: 1, y: 1, z: 1 });
  });
});

describe('parseConvexPolygonShape3D', () => {
  it('parses 8-vertex point cloud (24 floats)', () => {
    const points = parseConvexPolygonShape3D({
      points: 'PackedVector3Array(0,0,0, 1,0,0, 1,1,0, 0,1,0, 0,0,1, 1,0,1, 1,1,1, 0,1,1)',
    }).points;
    expect(points.length).toBe(24);
    expect(points.length / 3).toBe(8);
  });

  it('degrades to empty points (no throw) on malformed data', () => {
    // CollisionGizmo calls this directly in render with no error boundary, so
    // a hand-edited/corrupt array must not crash the whole scene preview.
    expect(() => parseConvexPolygonShape3D({ points: 'PackedVector3Array(1, x, 3)' })).not.toThrow();
    expect(parseConvexPolygonShape3D({ points: 'garbage' }).points.length).toBe(0);
    expect(parseConvexPolygonShape3D({}).points.length).toBe(0);
  });
});

describe('parseConcavePolygonShape3D', () => {
  it('parses a triangle soup', () => {
    const data = parseConcavePolygonShape3D({
      data: 'PackedVector3Array(0,0,0, 1,0,0, 0,1,0)',
    }).data;
    expect(data.length).toBe(9);
    expect(data.length % 9).toBe(0); // whole triangles
  });

  it('degrades to empty data (no throw) on malformed data', () => {
    expect(() => parseConcavePolygonShape3D({ data: 'PackedVector3Array(0, 0, nope)' })).not.toThrow();
    expect(parseConcavePolygonShape3D({ data: 'not-an-array' }).data.length).toBe(0);
    expect(parseConcavePolygonShape3D({}).data.length).toBe(0);
  });
});
