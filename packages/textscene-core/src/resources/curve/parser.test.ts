import { describe, expect, it } from 'vitest';
import { parseCurve, resolveCurve } from './parser';
import { CurveTangentMode } from './types';
import type { TscnInternalResource } from '../../parser/types';

/** The `scale_amount_curve` the isometric candle's Sparkle emitter carries. */
const CANDLE_SPARKLE = {
  _limits: '[0.0, 0.3, 0.0, 1.0]',
  _data:
    '[Vector2(0, 0), 0.0, 1.36377, 0, 0, Vector2(0.262376, 0.188182), 0.41974, 0.41974, 0, 0, ' +
    'Vector2(1, 0.0295454), -1.06101, 0.0, 0, 0]',
  point_count: '3',
};

describe('parseCurve', () => {
  it('reads every point of a three-point `_data` array (happy path)', () => {
    const curve = parseCurve(CANDLE_SPARKLE);

    expect(curve.points).toHaveLength(3);
    expect(curve.points[0]).toEqual({
      position: { x: 0, y: 0 },
      leftTangent: 0,
      rightTangent: 1.36377,
      leftMode: CurveTangentMode.Free,
      rightMode: CurveTangentMode.Free,
    });
    expect(curve.points[1]!.position).toEqual({ x: 0.262376, y: 0.188182 });
    expect(curve.points[2]!.leftTangent).toBeCloseTo(-1.06101, 5);
  });

  it('reads the four-element `_limits` as min/max value then min/max domain', () => {
    const curve = parseCurve(CANDLE_SPARKLE);
    expect(curve.minValue).toBe(0);
    expect(curve.maxValue).toBe(0.3);
    expect(curve.minDomain).toBe(0);
    expect(curve.maxDomain).toBe(1);
  });

  it('accepts the legacy two-element `_limits` and keeps the default domain', () => {
    const curve = parseCurve({ _limits: '[-2.0, 5.0]', _data: '[Vector2(0, 1), 0.0, 0.0, 0, 0]' });
    expect(curve.minValue).toBe(-2);
    expect(curve.maxValue).toBe(5);
    expect(curve.minDomain).toBe(0);
    expect(curve.maxDomain).toBe(1);
  });

  it('reads non-Free tangent modes', () => {
    const curve = parseCurve({ _data: '[Vector2(0, 0), 0.0, 0.0, 1, 1]' });
    expect(curve.points[0]!.leftMode).toBe(CurveTangentMode.Linear);
    expect(curve.points[0]!.rightMode).toBe(CurveTangentMode.Linear);
  });

  it('truncates to `point_count` when the property disagrees with `_data`', () => {
    const curve = parseCurve({
      _data: '[Vector2(0, 0), 0.0, 0.0, 0, 0, Vector2(1, 1), 0.0, 0.0, 0, 0]',
      point_count: '1',
    });
    expect(curve.points).toHaveLength(1);
  });

  it('returns an empty curve for a `_data` whose length is not a multiple of five (error path)', () => {
    const curve = parseCurve({ _data: '[Vector2(0, 0), 0.0, 0.0]' });
    expect(curve.points).toEqual([]);
  });

  it('returns an empty curve for a malformed `_data` literal (error path)', () => {
    expect(parseCurve({ _data: 'not an array' }).points).toEqual([]);
  });

  it('returns Godot resource defaults for an empty resource body (edge case)', () => {
    const curve = parseCurve({});
    expect(curve).toEqual({
      points: [],
      minValue: 0,
      maxValue: 1,
      minDomain: 0,
      maxDomain: 1,
    });
  });

  it('tolerates whitespace and newlines inside the array literal (edge case)', () => {
    const curve = parseCurve({ _data: '[\n  Vector2( 0 , 0.5 ),\n  1.0,\n  2.0,\n  0,\n  0\n]' });
    expect(curve.points[0]!.position).toEqual({ x: 0, y: 0.5 });
    expect(curve.points[0]!.rightTangent).toBe(2);
  });
});

const CURVE_RESOURCE: TscnInternalResource = {
  type: 'Curve',
  id: 1,
  data: { id: '4', ...CANDLE_SPARKLE },
};

describe('resolveCurve', () => {
  it('decodes the Curve a SubResource reference names (happy path)', () => {
    const curve = resolveCurve('SubResource("4")', [CURVE_RESOURCE]);
    expect(curve?.points).toHaveLength(3);
  });

  it('returns null when the reference names a different resource type (error path)', () => {
    const gradient: TscnInternalResource = { type: 'Gradient', id: 2, data: { id: '4' } };
    expect(resolveCurve('SubResource("4")', [gradient])).toBeNull();
  });

  it('returns null for an absent or non-SubResource reference (edge case)', () => {
    expect(resolveCurve(undefined, [CURVE_RESOURCE])).toBeNull();
    expect(resolveCurve('ExtResource("4")', [CURVE_RESOURCE])).toBeNull();
    expect(resolveCurve('SubResource("nope")', [CURVE_RESOURCE])).toBeNull();
  });
});
