import { describe, expect, it } from 'vitest';
import { parseCurve2DPoints, tessellateCurve2D } from './curve2d';

describe('parseCurve2DPoints', () => {
  it('parses the dodge_the_creeps rectangle path (zero tangents, 6 floats/point)', () => {
    // in.x, in.y, out.x, out.y, pos.x, pos.y per point.
    const data = '{\n"points": PackedVector2Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 480, 0)\n}';
    const points = parseCurve2DPoints(data);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({
      in: { x: 0, y: 0 },
      out: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
    });
    expect(points[1]!.position).toEqual({ x: 480, y: 0 });
  });

  it('parses non-zero in/out tangents', () => {
    const data = '{"points": PackedVector2Array(-10, -5, 10, 5, 100, 50, -20, 0, 20, 0, 300, 50)}';
    const points = parseCurve2DPoints(data);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({
      in: { x: -10, y: -5 },
      out: { x: 10, y: 5 },
      position: { x: 100, y: 50 },
    });
    expect(points[1]!.in).toEqual({ x: -20, y: 0 });
    expect(points[1]!.out).toEqual({ x: 20, y: 0 });
    expect(points[1]!.position).toEqual({ x: 300, y: 50 });
  });

  it('reads the points from an object-shaped _data (defensive)', () => {
    const points = parseCurve2DPoints({ points: 'PackedVector2Array(0,0,0,0,0,0, 0,0,0,0,10,0)' });
    expect(points).toHaveLength(2);
    expect(points[1]!.position).toEqual({ x: 10, y: 0 });
  });

  it('returns [] for missing / malformed data', () => {
    expect(parseCurve2DPoints(undefined)).toEqual([]);
    expect(parseCurve2DPoints('')).toEqual([]);
    expect(parseCurve2DPoints('{}')).toEqual([]);
    expect(parseCurve2DPoints('{"points": PackedVector2Array()}')).toEqual([]);
  });

  it('drops a trailing partial point (not a multiple of 6 floats)', () => {
    const points = parseCurve2DPoints('{"points": PackedVector2Array(0,0,0,0,0,0, 0,0,0,0)}');
    expect(points).toHaveLength(1);
  });
});

describe('tessellateCurve2D', () => {
  it('tessellates a straight span (zero tangents) into a single segment', () => {
    const sampler = tessellateCurve2D(parseCurve2DPoints('{"points": PackedVector2Array(0,0,0,0,0,0, 0,0,0,0,480,0)}'));
    expect(sampler.points).toEqual([0, 0, 480, 0]);
    expect(sampler.length).toBeCloseTo(480, 5);
  });

  it('samples position + tangent angle along a straight horizontal span', () => {
    const sampler = tessellateCurve2D(parseCurve2DPoints('{"points": PackedVector2Array(0,0,0,0,0,0, 0,0,0,0,480,0)}'));
    expect(sampler.sampleAt(240)).toEqual({ x: 240, y: 0, angle: 0 });
    // Clamped to the endpoints.
    expect(sampler.sampleAt(-50).x).toBeCloseTo(0, 5);
    expect(sampler.sampleAt(99999).x).toBeCloseTo(480, 5);
  });

  it('subdivides a curved span — arc length exceeds the straight chord', () => {
    // A bowed span: both tangents push the curve away from the straight chord.
    const points = parseCurve2DPoints('{"points": PackedVector2Array(0,0,0,100,0,0, 0,-100,0,0,100,0)}');
    const sampler = tessellateCurve2D(points, 16);
    expect(sampler.points.length).toBeGreaterThan(4); // more than the 2 endpoints
    expect(sampler.length).toBeGreaterThan(100); // chord is 100; bowed arc is longer
  });

  it('handles degenerate input (0 or 1 points)', () => {
    expect(tessellateCurve2D([]).length).toBe(0);
    expect(tessellateCurve2D([]).points).toEqual([]);
    const one = tessellateCurve2D(parseCurve2DPoints('{"points": PackedVector2Array(0,0,0,0,5,7)}'));
    expect(one.length).toBe(0);
    expect(one.sampleAt(10)).toEqual({ x: 5, y: 7, angle: 0 });
  });
});
