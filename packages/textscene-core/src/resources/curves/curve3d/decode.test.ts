import { describe, expect, it } from 'vitest';
import { decodeCurve3D, tessellateCurve3D } from './decode';
import { MAX_PADDED_POINTS } from '../shared/pointCount';

/** A Curve3D body whose `_data` holds `points` as written and `tilts`, plus any other properties. */
function body(
  points: string,
  properties: Record<string, string> = {},
  tilts = 'PackedFloat32Array()'
): Record<string, string> {
  return { _data: `{\n"points": ${points},\n"tilts": ${tilts}\n}`, ...properties };
}

function pointsOf(points: string) {
  return decodeCurve3D(body(points));
}

const ORIGIN_POINT = {
  in: { x: 0, y: 0, z: 0 },
  out: { x: 0, y: 0, z: 0 },
  position: { x: 0, y: 0, z: 0 },
};

describe('decodeCurve3D', () => {
  it('reads a straight path (zero tangents, 9 floats/point: in/out/pos)', () => {
    // in.xyz, out.xyz, pos.xyz per point.
    const points = pointsOf('PackedVector3Array(0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 10,0,0)');
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual(ORIGIN_POINT);
    expect(points[1]!.position).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('reads non-zero in/out tangents', () => {
    const points = pointsOf('PackedVector3Array(-1,-2,-3, 1,2,3, 5,5,5, -4,0,0, 4,0,0, 20,0,0)');
    expect(points).toHaveLength(2);
    expect(points[0]!.in).toEqual({ x: -1, y: -2, z: -3 });
    expect(points[0]!.out).toEqual({ x: 1, y: 2, z: 3 });
    expect(points[0]!.position).toEqual({ x: 5, y: 5, z: 5 });
    expect(points[1]!.in).toEqual({ x: -4, y: 0, z: 0 });
  });

  // `curve.cpp:2282` converts `p_data["points"]` through the Variant, and ARRAY
  // is a strict source for PACKED_VECTOR3_ARRAY (variant.cpp:449-478), so both
  // array spellings load the same two points.
  it('reads the bare-array and typed-array spellings of points', () => {
    const bare = decodeCurve3D(body(
      '[Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(10, 0, 0)]',
      {},
      '[0, 0]'
    ));
    expect(bare).toHaveLength(2);
    expect(bare[1]!.position).toEqual({ x: 10, y: 0, z: 0 });
    const typed = decodeCurve3D(body(
      'Array[Vector3]([Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(10, 0, 0)])',
      {},
      'Array[float]([0, 0])'
    ));
    expect(typed).toHaveLength(2);
  });

  it('loads no points from an absent, empty or unreadable _data', () => {
    expect(decodeCurve3D({})).toEqual([]);
    expect(decodeCurve3D({ _data: '' })).toEqual([]);
    expect(pointsOf('PackedVector3Array()')).toEqual([]);
    expect(pointsOf('PackedVector3Array(0,0,0, 0,0,0, 0,0,x)')).toEqual([]);
  });

  // `_set_data` fails on `!p_data.has("points")` (curve.cpp:2279).
  it('loads no points from a _data without "points"', () => {
    expect(decodeCurve3D({ _data: '{\n"tilts": PackedFloat32Array()\n}' })).toEqual([]);
  });

  // `_set_data` fails on `!p_data.has("tilts")` (curve.cpp:2280), though the
  // renderer never reads a tilt.
  it('loads no points from a _data without "tilts"', () => {
    const noTilts = '{\n"points": PackedVector3Array(0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 10,0,0)\n}';
    expect(decodeCurve3D({ _data: noTilts })).toEqual([]);
  });

  // `_set_data` fails on `pc % 3 != 0` (curve.cpp:2284) before it touches the list,
  // so a trailing partial point loses the whole curve, not only its tail.
  it('loads no points when "points" is not a whole number of control points', () => {
    expect(pointsOf('PackedVector3Array(0,0,0, 0,0,0, 0,0,0, 0,0,0)')).toEqual([]);
  });

  describe('point_count', () => {
    const TWO_POINTS = 'PackedVector3Array(0,0,0, 0,0,0, 10,0,0, 0,0,0, 0,0,0, 20,0,0)';

    // `set_point_count` resizes the list to the count (curve.cpp:1455-1456).
    it('drops the tail at a smaller point_count', () => {
      const points = decodeCurve3D(body(TWO_POINTS, { point_count: '1' }));
      expect(points.map((p) => p.position)).toEqual([{ x: 10, y: 0, z: 0 }]);
    });

    // `_add_point(Vector3())` appends at the end (curve.cpp:1459-1460, 1471-1474).
    it('appends origin points after the authored ones at a larger point_count', () => {
      const points = decodeCurve3D(body(TWO_POINTS, { point_count: '3' }));
      expect(points.map((p) => p.position)).toEqual([
        { x: 10, y: 0, z: 0 },
        { x: 20, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ]);
      expect(points[2]).toEqual(ORIGIN_POINT);
    });

    it('keeps the authored points at an equal point_count', () => {
      expect(decodeCurve3D(body(TWO_POINTS, { point_count: '2' }))).toHaveLength(2);
    });

    // `ERR_FAIL_COND(p_count < 0)` (curve.cpp:1449) leaves the list as `_data` set it.
    it('ignores a negative point_count', () => {
      expect(decodeCurve3D(body(TWO_POINTS, { point_count: '-3' }))).toHaveLength(2);
    });

    it('pads from zero points when _data is refused', () => {
      const points = decodeCurve3D({ _data: '{}', point_count: '2' });
      expect(points).toEqual([ORIGIN_POINT, ORIGIN_POINT]);
    });

    it(`stops padding at ${MAX_PADDED_POINTS} points`, () => {
      const points = decodeCurve3D(body(TWO_POINTS, { point_count: '100000000' }));
      expect(points).toHaveLength(MAX_PADDED_POINTS);
    });
  });
});

describe('tessellateCurve3D', () => {
  it('tessellates a straight span into a single segment with correct length', () => {
    const sampler = tessellateCurve3D(
      pointsOf('PackedVector3Array(0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 10,0,0)')
    );
    expect(sampler.points).toEqual([0, 0, 0, 10, 0, 0]);
    expect(sampler.length).toBeCloseTo(10, 5);
  });

  it('samples position + unit tangent along a straight span', () => {
    const sampler = tessellateCurve3D(
      pointsOf('PackedVector3Array(0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 10,0,0)')
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
    const points = pointsOf('PackedVector3Array(0,0,0, 0,10,0, 0,0,0, 0,-10,0, 0,0,0, 10,0,0)');
    const sampler = tessellateCurve3D(points, 16);
    expect(sampler.points.length).toBeGreaterThan(6);
    expect(sampler.length).toBeGreaterThan(10);
  });

  it('handles degenerate input (0 or 1 points)', () => {
    expect(tessellateCurve3D([]).length).toBe(0);
    const one = tessellateCurve3D(pointsOf('PackedVector3Array(0,0,0, 0,0,0, 2,3,4)'));
    expect(one.length).toBe(0);
    const s = one.sampleAt(10);
    expect(s.x).toBe(2);
    expect(s.y).toBe(3);
    expect(s.z).toBe(4);
  });
});
