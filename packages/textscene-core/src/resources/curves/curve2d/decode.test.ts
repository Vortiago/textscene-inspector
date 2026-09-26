import { describe, expect, it } from 'vitest';
import { decodeCurve2D, tessellateCurve2D } from './decode';
import { MAX_PADDED_POINTS } from '../shared/pointCount';

/** A Curve2D body whose `_data` holds `points` as written, plus any other properties. */
function body(points: string, properties: Record<string, string> = {}): Record<string, string> {
  return { _data: `{\n"points": ${points}\n}`, ...properties };
}

function pointsOf(points: string) {
  return decodeCurve2D(body(points));
}

const ORIGIN_POINT = { in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, position: { x: 0, y: 0 } };

describe('decodeCurve2D', () => {
  it('reads the dodge_the_creeps rectangle path (zero tangents, 6 floats/point)', () => {
    // in.x, in.y, out.x, out.y, pos.x, pos.y per point.
    const points = pointsOf('PackedVector2Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 480, 0)');
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual(ORIGIN_POINT);
    expect(points[1]!.position).toEqual({ x: 480, y: 0 });
  });

  it('reads non-zero in/out tangents', () => {
    const points = pointsOf('PackedVector2Array(-10, -5, 10, 5, 100, 50, -20, 0, 20, 0, 300, 50)');
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

  // `curve.cpp:1241` `PackedVector2Array rp = p_data["points"]` converts through
  // the Variant, and ARRAY is a strict source for PACKED_VECTOR2_ARRAY
  // (variant.cpp:449-478), so both array spellings load the same two points.
  it('reads the bare-array and typed-array spellings of points', () => {
    const bare = pointsOf('[Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(10, 0)]');
    expect(bare).toHaveLength(2);
    expect(bare[1]!.position).toEqual({ x: 10, y: 0 });
    const typed = pointsOf('Array[Vector2]([Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(10, 0)])');
    expect(typed).toHaveLength(2);
  });

  it('loads no points from an absent, empty or unreadable _data', () => {
    expect(decodeCurve2D({})).toEqual([]);
    expect(decodeCurve2D({ _data: '' })).toEqual([]);
    expect(pointsOf('PackedVector2Array()')).toEqual([]);
    expect(pointsOf('PackedVector2Array(0, 0, 0, 0, 0, x)')).toEqual([]);
  });

  // `_set_data` fails on `!p_data.has("points")` (curve.cpp:1239).
  it('loads no points from a _data without "points"', () => {
    expect(decodeCurve2D({ _data: '{}' })).toEqual([]);
  });

  // `_set_data` fails on `pc % 3 != 0` (curve.cpp:1243) before it touches the list,
  // so a trailing partial point loses the whole curve, not only its tail.
  it('loads no points when "points" is not a whole number of control points', () => {
    expect(pointsOf('PackedVector2Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)')).toEqual([]);
  });

  describe('point_count', () => {
    const TWO_POINTS = 'PackedVector2Array(0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 20, 0)';

    // `set_point_count` resizes the list to the count (curve.cpp:728-729).
    it('drops the tail at a smaller point_count', () => {
      const points = decodeCurve2D(body(TWO_POINTS, { point_count: '1' }));
      expect(points.map((p) => p.position)).toEqual([{ x: 10, y: 0 }]);
    });

    // `_add_point(Vector2())` appends at the end (curve.cpp:732-733, 744-747),
    // unlike `Curve`, which seats a padded point in offset order.
    it('appends origin points after the authored ones at a larger point_count', () => {
      const points = decodeCurve2D(body(TWO_POINTS, { point_count: '4' }));
      expect(points.map((p) => p.position)).toEqual([
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]);
      expect(points[3]).toEqual(ORIGIN_POINT);
    });

    it('keeps the authored points at an equal point_count', () => {
      const points = decodeCurve2D(body(TWO_POINTS, { point_count: '2' }));
      expect(points.map((p) => p.position)).toEqual([{ x: 10, y: 0 }, { x: 20, y: 0 }]);
    });

    // `ERR_FAIL_COND(p_count < 0)` (curve.cpp:722) leaves the list as `_data` set it.
    it('ignores a negative point_count', () => {
      expect(decodeCurve2D(body(TWO_POINTS, { point_count: '-1' }))).toHaveLength(2);
    });

    // A refused `_data` leaves the list empty, and the count still pads it.
    it('pads from zero points when _data is refused', () => {
      const points = decodeCurve2D({ _data: '{}', point_count: '2' });
      expect(points).toEqual([ORIGIN_POINT, ORIGIN_POINT]);
    });

    it(`stops padding at ${MAX_PADDED_POINTS} points`, () => {
      const points = decodeCurve2D(body(TWO_POINTS, { point_count: '100000000' }));
      expect(points).toHaveLength(MAX_PADDED_POINTS);
    });
  });
});

describe('tessellateCurve2D', () => {
  it('tessellates a straight span (zero tangents) into a single segment', () => {
    const sampler = tessellateCurve2D(pointsOf('PackedVector2Array(0,0,0,0,0,0, 0,0,0,0,480,0)'));
    expect(sampler.points).toEqual([0, 0, 480, 0]);
    expect(sampler.length).toBeCloseTo(480, 5);
  });

  it('samples position + tangent angle along a straight horizontal span', () => {
    const sampler = tessellateCurve2D(pointsOf('PackedVector2Array(0,0,0,0,0,0, 0,0,0,0,480,0)'));
    expect(sampler.sampleAt(240)).toEqual({ x: 240, y: 0, angle: 0 });
    // Clamped to the endpoints.
    expect(sampler.sampleAt(-50).x).toBeCloseTo(0, 5);
    expect(sampler.sampleAt(99999).x).toBeCloseTo(480, 5);
  });

  it('subdivides a curved span — arc length exceeds the straight chord', () => {
    // A bowed span: both tangents push the curve away from the straight chord.
    const points = pointsOf('PackedVector2Array(0,0,0,100,0,0, 0,-100,0,0,100,0)');
    const sampler = tessellateCurve2D(points, 16);
    expect(sampler.points.length).toBeGreaterThan(4); // more than the 2 endpoints
    expect(sampler.length).toBeGreaterThan(100); // chord is 100; bowed arc is longer
  });

  it('handles degenerate input (0 or 1 points)', () => {
    expect(tessellateCurve2D([]).length).toBe(0);
    expect(tessellateCurve2D([]).points).toEqual([]);
    const one = tessellateCurve2D(pointsOf('PackedVector2Array(0,0,0,0,5,7)'));
    expect(one.length).toBe(0);
    expect(one.sampleAt(10)).toEqual({ x: 5, y: 7, angle: 0 });
  });
});
