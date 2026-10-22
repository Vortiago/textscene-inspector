import { describe, expect, it } from 'vitest';
import { decodeCurveResource } from './decode';
import { subResource } from '../../../testing/subResource';
import { MAX_PADDED_POINTS } from '../shared/pointCount';
import { sampleCurve } from './sample';
import { CurveTangentMode, EMPTY_CURVE, type Curve } from './types';
import type { TscnInternalResource } from '../../../parser/types';

/** The `scale_amount_curve` the isometric candle's Sparkle emitter carries. */
const CANDLE_SPARKLE = {
  _limits: '[0.0, 0.3, 0.0, 1.0]',
  _data:
    '[Vector2(0, 0), 0.0, 1.36377, 0, 0, Vector2(0.262376, 0.188182), 0.41974, 0.41974, 0, 0, ' +
    'Vector2(1, 0.0295454), -1.06101, 0.0, 0, 0]',
  point_count: '3',
};

/** The Curve a sub-resource with this body decodes to. */
function decode(data: Record<string, string>): Curve {
  return decodeCurveResource(subResource('Curve', 'only', data))!;
}

describe('the Curve body decodeCurveResource decodes', () => {
  it('reads every point of a three-point `_data` array (happy path)', () => {
    const curve = decode(CANDLE_SPARKLE);

    expect(curve.points).toHaveLength(3);
    expect(curve.points[0]).toEqual({
      position: { x: 0, y: 0 },
      leftTangent: 0,
      rightTangent: Math.fround(1.36377),
      leftMode: CurveTangentMode.Free,
      rightMode: CurveTangentMode.Free,
    });
    expect(curve.points[1]!.position).toEqual({ x: Math.fround(0.262376), y: Math.fround(0.188182) });
    expect(curve.points[2]!.leftTangent).toBeCloseTo(-1.06101, 5);
  });

  it('reads the four-element `_limits` as min/max value then min/max domain', () => {
    const curve = decode(CANDLE_SPARKLE);
    expect(curve.minValue).toBe(0);
    expect(curve.maxValue).toBe(Math.fround(0.3));
    expect(curve.minDomain).toBe(0);
    expect(curve.maxDomain).toBe(1);
  });

  it('accepts the legacy two-element `_limits` and keeps the default domain', () => {
    const curve = decode({ _limits: '[-2.0, 5.0]', _data: '[Vector2(0, 1), 0.0, 0.0, 0, 0]' });
    expect(curve.minValue).toBe(-2);
    expect(curve.maxValue).toBe(5);
    expect(curve.minDomain).toBe(0);
    expect(curve.maxDomain).toBe(1);
  });

  it('reads non-Free tangent modes', () => {
    const curve = decode({ _data: '[Vector2(0, 0), 0.0, 0.0, 1, 1]' });
    expect(curve.points[0]!.leftMode).toBe(CurveTangentMode.Linear);
    expect(curve.points[0]!.rightMode).toBe(CurveTangentMode.Linear);
  });

  it('truncates to `point_count` when the property disagrees with `_data`', () => {
    const curve = decode({
      _data: '[Vector2(0, 0), 0.0, 0.0, 0, 0, Vector2(1, 1), 0.0, 0.0, 0, 0]',
      point_count: '1',
    });
    expect(curve.points).toHaveLength(1);
  });

  it('returns an empty curve for a `_data` whose length is not a multiple of five (error path)', () => {
    const curve = decode({ _data: '[Vector2(0, 0), 0.0, 0.0]' });
    expect(curve.points).toEqual([]);
  });

  it('returns an empty curve for a malformed `_data` literal (error path)', () => {
    expect(decode({ _data: 'not an array' }).points).toEqual([]);
  });

  it('drops a point whose component overflows to Infinity (error path)', () => {
    // `1e999` is ordinary digits and an exponent, so it is inside the finite
    // grammar and only the result betrays it. Reaching `sampleCurve`, it
    // multiplies Infinity/NaN into the particle geometry that samples the curve.
    const curve = decode({ _data: '[Vector2(0, 1e999), 0.0, 0.0, 0, 0]' });

    expect(curve.points).toEqual([]);
    expect(sampleCurve(curve, 0.5)).toBe(0);
  });

  it('drops every point when one is unreadable, as `set_data` does (error path)', () => {
    // `set_data` validates the whole array before it writes any of it
    // (`curve.cpp:465`, first write `:477`), so one non-Vector2 entry leaves
    // Godot with NO points. Keeping the readable neighbours drew a curve
    // through samples the engine never produces.
    const curve = decode({
      _data:
        '[Vector2(0, 0), 0.0, 0.0, 0, 0, Vector2(0.5, 1e999), 0.0, 0.0, 0, 0, Vector2(1, 1), 0.0, 0.0, 0, 0]',
    });

    expect(curve.points).toEqual([]);
    expect(sampleCurve(curve, 0.5)).toBe(0);
  });

  it("lets `point_count` pad the emptied list, which is the engine's own result", () => {
    // `_data` is refused wholesale, then `set_point_count` pads with
    // `_add_point(Vector2())` (`curve.cpp:41-57`) whose position is clamped to
    // the domain floor (`:63`): three points at the origin, sampling 0.
    const curve = decode({
      _data:
        '[Vector2(0, 0), 0.0, 0.0, 0, 0, Vector2(0.5, 1e999), 0.0, 0.0, 0, 0, Vector2(1, 1), 0.0, 0.0, 0, 0]',
      point_count: '3',
    });

    expect(curve.points).toHaveLength(3);
    expect(curve.points.map((p) => p.position)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
    expect(sampleCurve(curve, 0.5)).toBe(0);
  });

  it('falls back on a non-finite TANGENT, as it does on a non-finite position', () => {
    const curve = decode({
      _data: '[Vector2(0, 0), 0.0, inf, 0, 0, Vector2(1, 1), 0.0, 0.0, 0, 0]',
    });

    expect(curve.points[0]!.rightTangent).toBe(0);
    expect(sampleCurve(curve, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('declines a non-finite `_limits` rather than clamping every point onto it', () => {
    const curve = decode({ _limits: '[inf, 2.0, 0.0, 3.0]', _data: '[Vector2(1, 1), 0.0, 0.0, 0, 0]' });

    expect(curve.minValue).toBe(EMPTY_CURVE.minValue);
    expect(curve.maxValue).toBe(EMPTY_CURVE.maxValue);
  });

  it('narrows a `Vector2i` position to int32, the way the slot conversion does', () => {
    // `slotTupleRegex` admits the spelling on purpose; `_parse_construct<int32_t>`
    // narrows each argument before it widens into the float slot.
    expect(decode({ _data: '[Vector2i(4294967295, 0), 0.0, 0.0, 0, 0]' }).points[0]!.position).toEqual({
      x: -1,
      y: 0,
    });
  });

  it('places a `Vector2i` point past the round-trip band where Godot stores it', () => {
    expect(decode({ _data: '[Vector2i(4294967296, 5), 0.0, 0.0, 0, 0]' }).points).toEqual([
      expect.objectContaining({ position: { x: 0, y: 5 } }),
    ]);
  });

  it('returns Godot resource defaults for an empty resource body (edge case)', () => {
    const curve = decode({});
    expect(curve).toEqual({
      points: [],
      minValue: 0,
      maxValue: 1,
      minDomain: 0,
      maxDomain: 1,
      bakeResolution: 100,
    });
  });

  it('tolerates whitespace and newlines inside the array literal (edge case)', () => {
    const curve = decode({ _data: '[\n  Vector2( 0 , 0.5 ),\n  1.0,\n  2.0,\n  0,\n  0\n]' });
    expect(curve.points[0]!.position).toEqual({ x: 0, y: 0.5 });
    expect(curve.points[0]!.rightTangent).toBe(2);
  });
});

describe('`point_count` resizes the decoded point list', () => {
  /** The default point `Curve::_add_point` appends: `Vector2()`, no tangents, Free. */
  const DEFAULT_POINT = {
    position: { x: 0, y: 0 },
    leftTangent: 0,
    rightTangent: 0,
    leftMode: CurveTangentMode.Free,
    rightMode: CurveTangentMode.Free,
  };

  it('pads with Godot’s default point when the count exceeds `_data`', () => {
    const curve = decode({ _data: '[Vector2(1, 1), 0.5, 0.5, 1, 1]', point_count: '3' });

    expect(curve.points).toHaveLength(3);
    expect(curve.points[0]).toEqual(DEFAULT_POINT);
    expect(curve.points[1]).toEqual(DEFAULT_POINT);
    // `leftTangent` is 1, not the written 0.5: `_add_point` ends in
    // `update_auto_tangents` (curve.cpp:100), and a Linear endpoint re-aims at
    // the neighbour that just arrived: here the slope from (0,0) to (1,1).
    expect(curve.points[2]).toEqual({
      position: { x: 1, y: 1 },
      leftTangent: 1,
      rightTangent: 0.5,
      leftMode: CurveTangentMode.Linear,
      rightMode: CurveTangentMode.Linear,
    });
  });

  it('re-aims only a LINEAR endpoint, leaving a Free neighbour’s tangent alone', () => {
    const curve = decode({ _data: '[Vector2(1, 1), 0.5, 0.5, 0, 0]', point_count: '2' });

    expect(curve.points[1]!.leftTangent).toBe(0.5);
    expect(curve.points[1]!.rightTangent).toBe(0.5);
  });

  it('samples the curve Godot samples once the pad has re-aimed the tangent', () => {
    const curve = decode({ _data: '[Vector2(1, 1), 0.5, 0.5, 1, 1]', point_count: '2' });

    expect(sampleCurve(curve, 0.5)).toBeCloseTo(0.375, 6);
  });

  it('seats a padded point in offset order, so sampling interpolates', () => {
    // One point makes `sampleCurve` answer a constant; the padded point at the
    // domain start gives it a span to interpolate across.
    const curve = decode({ _data: '[Vector2(1, 1), 0.0, 0.0, 0, 0]', point_count: '2' });

    expect(curve.points.map((p) => p.position)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(sampleCurve(curve, 0)).toBe(0);
    expect(sampleCurve(curve, 0.5)).toBeCloseTo(0.5, 5);
    expect(sampleCurve(curve, 1)).toBe(1);
  });

  it('seats the pad ahead of a LONE point of equal offset', () => {
    // `_add_point`'s one-point branch inserts at 0 unless the new offset is
    // strictly greater; its general branch seats an equal offset after instead.
    const curve = decode({ _data: '[Vector2(0, 0.5), 0.0, 0.0, 0, 0]', point_count: '3' });

    expect(curve.points.map((p) => p.position.y)).toEqual([0, 0, 0.5]);
  });

  it('clamps the padded position into the curve’s own ranges', () => {
    const curve = decode({
      _limits: '[2.0, 5.0, 1.0, 3.0]',
      _data: '[Vector2(3, 4), 0.0, 0.0, 0, 0]',
      point_count: '2',
    });

    expect(curve.points[0]!.position).toEqual({ x: 1, y: 2 });
  });

  it('keeps every decoded point when the count is negative (error path)', () => {
    // `ERR_FAIL_COND(p_count < 0)` returns before touching the point list.
    expect(decode({ ...CANDLE_SPARKLE, point_count: '-1' }).points).toHaveLength(3);
  });

  it('stops padding at `MAX_PADDED_POINTS` (edge case)', () => {
    const curve = decode({ ...CANDLE_SPARKLE, point_count: '100000' });

    expect(curve.points).toHaveLength(MAX_PADDED_POINTS);
  });
});

const CURVE_RESOURCE: TscnInternalResource = {
  type: 'Curve',
  id: '4',
  data: { ...CANDLE_SPARKLE },
};

describe('decodeCurveResource', () => {
  it('decodes the Curve a resource holds (happy path)', () => {
    expect(decodeCurveResource(CURVE_RESOURCE)?.points).toHaveLength(3);
  });

  it('returns null for a resource of a different type (error path)', () => {
    const gradient: TscnInternalResource = { type: 'Gradient', id: '4', data: {} };
    expect(decodeCurveResource(gradient)).toBeNull();
  });

  it('returns null for no resource (edge case)', () => {
    expect(decodeCurveResource(null)).toBeNull();
  });
});

describe('a Variant number Godot reads differently from `parseInt`', () => {
  // `parseInt`/`parseFloat` stop at the first character they cannot use, so an
  // entry Godot refuses outright came back as a plausible number and every
  // sample of the curve was scaled by it.
  it('rejects a `_limits` entry the tokenizer cannot read, rather than truncating it', () => {
    const curve = decode({ ...CANDLE_SPARKLE, _limits: '[0.0, 5abc, 0.0, 1.0]' });

    // `parseFloat` read `5abc` as 5 and scaled every sample by a maximum the
    // file does not contain. Godot cannot read the token, so the literal is
    // unreadable and the documented fall-back applies.
    expect(curve.maxValue).toBe(EMPTY_CURVE.maxValue);
  });

  it('reads an exponent-typed `point_count` as the integer Godot stores', () => {
    // `2e1` is 20 to Godot's tokenizer and 2 to `parseInt`: the smaller number
    // slices the three-point list down to two, the larger pads it out to 20.
    const curve = decode({ ...CANDLE_SPARKLE, point_count: '2e1' });

    expect(curve.points).toHaveLength(20);
  });

  it('does not read a tangent mode out of text the tokenizer refuses', () => {
    // `parseInt` read `1abc` as 1 and reported Linear for a token Godot cannot
    // load at all.
    const curve = decode({ ...CANDLE_SPARKLE, _data: '[Vector2(0, 0), 0.0, 0.0, 1abc, 0]' });

    expect(curve.points[0]!.leftMode).toBe(CurveTangentMode.Free);
  });
});

describe('`bake_resolution`, which `Curve.sample_baked` reads', () => {
  // `set_bake_resolution` ERR_FAILs outside 1 to 1000 (`curve.cpp:526-527`) and keeps the default 100 (`curve.h:163`).
  it('defaults to 100', () => {
    expect(decode({}).bakeResolution).toBe(100);
  });

  it('reads an authored value', () => {
    expect(decode({ bake_resolution: '12' }).bakeResolution).toBe(12);
  });

  it('keeps the default for a value the setter refuses', () => {
    expect(decode({ bake_resolution: '0' }).bakeResolution).toBe(100);
    expect(decode({ bake_resolution: '1001' }).bakeResolution).toBe(100);
    expect(decode({ bake_resolution: '1000' }).bakeResolution).toBe(1000);
  });
});

describe('the floats a Curve holds', () => {
  // Every position, tangent and limit is a `real_t`, which an official build keeps as a float.
  it('rounds each position and tangent to single precision', () => {
    const point = decode({ _data: '[Vector2(0.1, 0.3), 0.7, 0.9, 0, 0]' }).points[0]!;

    expect(point.position).toEqual({ x: Math.fround(0.1), y: Math.fround(0.3) });
    expect(point.leftTangent).toBe(Math.fround(0.7));
    expect(point.rightTangent).toBe(Math.fround(0.9));
  });

  it('rounds the limits to single precision', () => {
    const curve = decode({ _limits: '[0.1, 0.7, 0.2, 0.9]' });

    expect([curve.minValue, curve.maxValue, curve.minDomain, curve.maxDomain]).toEqual(
      [0.1, 0.7, 0.2, 0.9].map(Math.fround)
    );
  });
});
