import { describe, expect, it } from 'vitest';
import { parseCurve3DPoints, tessellateCurve3D } from './curve3d';

describe('parseCurve3DPoints', () => {
  it('parses a straight path (zero tangents, 9 floats/point: in/out/pos)', () => {
    // in.xyz, out.xyz, pos.xyz per point.
    const data =
      '{\n"points": PackedVector3Array(0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 10,0,0)\n}';
    const points = parseCurve3DPoints(data);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({
      in: { x: 0, y: 0, z: 0 },
      out: { x: 0, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 },
    });
    expect(points[1]!.position).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('parses non-zero in/out tangents', () => {
    const data =
      '{"points": PackedVector3Array(-1,-2,-3, 1,2,3, 5,5,5, -4,0,0, 4,0,0, 20,0,0)}';
    const points = parseCurve3DPoints(data);
    expect(points).toHaveLength(2);
    expect(points[0]!.in).toEqual({ x: -1, y: -2, z: -3 });
    expect(points[0]!.out).toEqual({ x: 1, y: 2, z: 3 });
    expect(points[0]!.position).toEqual({ x: 5, y: 5, z: 5 });
    expect(points[1]!.in).toEqual({ x: -4, y: 0, z: 0 });
  });

  it('reads object-shaped _data and ignores a sibling tilts array (defensive)', () => {
    const points = parseCurve3DPoints({
      points: 'PackedVector3Array(0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,3,0)',
      tilts: 'PackedFloat32Array(0, 0)',
    });
    expect(points).toHaveLength(2);
    expect(points[1]!.position).toEqual({ x: 0, y: 3, z: 0 });
  });

  it('returns [] for missing / malformed / empty data', () => {
    expect(parseCurve3DPoints(undefined)).toEqual([]);
    expect(parseCurve3DPoints('{}')).toEqual([]);
    expect(parseCurve3DPoints('{"points": PackedVector3Array()}')).toEqual([]);
  });
});

describe('tessellateCurve3D', () => {
  it('tessellates a straight span into a single segment with correct length', () => {
    const sampler = tessellateCurve3D(
      parseCurve3DPoints('{"points": PackedVector3Array(0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 10,0,0)}')
    );
    expect(sampler.points).toEqual([0, 0, 0, 10, 0, 0]);
    expect(sampler.length).toBeCloseTo(10, 5);
  });

  it('samples position + unit tangent along a straight span', () => {
    const sampler = tessellateCurve3D(
      parseCurve3DPoints('{"points": PackedVector3Array(0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 10,0,0)}')
    );
    const s = sampler.sampleAt(5);
    expect(s.x).toBeCloseTo(5, 5);
    expect(s.y).toBeCloseTo(0, 5);
    expect(s.z).toBeCloseTo(0, 5);
    expect(s.tangent.x).toBeCloseTo(1, 5);
    expect(s.tangent.y).toBeCloseTo(0, 5);
    expect(s.tangent.z).toBeCloseTo(0, 5);
    // Clamped.
    expect(sampler.sampleAt(-9).x).toBeCloseTo(0, 5);
    expect(sampler.sampleAt(999).x).toBeCloseTo(10, 5);
  });

  it('subdivides a curved span — arc length exceeds the straight chord', () => {
    const points = parseCurve3DPoints(
      '{"points": PackedVector3Array(0,0,0, 0,10,0, 0,0,0, 0,-10,0, 0,0,0, 10,0,0)}'
    );
    const sampler = tessellateCurve3D(points, 16);
    expect(sampler.points.length).toBeGreaterThan(6);
    expect(sampler.length).toBeGreaterThan(10);
  });

  it('handles degenerate input (0 or 1 points)', () => {
    expect(tessellateCurve3D([]).length).toBe(0);
    const one = tessellateCurve3D(parseCurve3DPoints('{"points": PackedVector3Array(0,0,0, 0,0,0, 2,3,4)}'));
    expect(one.length).toBe(0);
    const s = one.sampleAt(10);
    expect(s.x).toBe(2);
    expect(s.y).toBe(3);
    expect(s.z).toBe(4);
  });
});
