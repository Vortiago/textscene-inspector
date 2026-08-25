import { describe, expect, it } from 'vitest';
import { curveFromResource, decodeCurve, resolveCurve } from './decode';
import { MAX_PADDED_POINTS } from './pointCount';
import { sampleCurve } from './sample';
import { CurveTangentMode, EMPTY_CURVE } from './types';
import { parseTresFile } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';

/** The `scale_amount_curve` the isometric candle's Sparkle emitter carries. */
const CANDLE_SPARKLE = {
  _limits: '[0.0, 0.3, 0.0, 1.0]',
  _data:
    '[Vector2(0, 0), 0.0, 1.36377, 0, 0, Vector2(0.262376, 0.188182), 0.41974, 0.41974, 0, 0, ' +
    'Vector2(1, 0.0295454), -1.06101, 0.0, 0, 0]',
  point_count: '3',
};

describe('decodeCurve', () => {
  it('reads every point of a three-point `_data` array (happy path)', () => {
    const curve = decodeCurve(CANDLE_SPARKLE);

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
    const curve = decodeCurve(CANDLE_SPARKLE);
    expect(curve.minValue).toBe(0);
    expect(curve.maxValue).toBe(0.3);
    expect(curve.minDomain).toBe(0);
    expect(curve.maxDomain).toBe(1);
  });

  it('accepts the legacy two-element `_limits` and keeps the default domain', () => {
    const curve = decodeCurve({ _limits: '[-2.0, 5.0]', _data: '[Vector2(0, 1), 0.0, 0.0, 0, 0]' });
    expect(curve.minValue).toBe(-2);
    expect(curve.maxValue).toBe(5);
    expect(curve.minDomain).toBe(0);
    expect(curve.maxDomain).toBe(1);
  });

  it('reads non-Free tangent modes', () => {
    const curve = decodeCurve({ _data: '[Vector2(0, 0), 0.0, 0.0, 1, 1]' });
    expect(curve.points[0]!.leftMode).toBe(CurveTangentMode.Linear);
    expect(curve.points[0]!.rightMode).toBe(CurveTangentMode.Linear);
  });

  it('truncates to `point_count` when the property disagrees with `_data`', () => {
    const curve = decodeCurve({
      _data: '[Vector2(0, 0), 0.0, 0.0, 0, 0, Vector2(1, 1), 0.0, 0.0, 0, 0]',
      point_count: '1',
    });
    expect(curve.points).toHaveLength(1);
  });

  it('returns an empty curve for a `_data` whose length is not a multiple of five (error path)', () => {
    const curve = decodeCurve({ _data: '[Vector2(0, 0), 0.0, 0.0]' });
    expect(curve.points).toEqual([]);
  });

  it('returns an empty curve for a malformed `_data` literal (error path)', () => {
    expect(decodeCurve({ _data: 'not an array' }).points).toEqual([]);
  });

  it('drops a point whose component overflows to Infinity (error path)', () => {
    // `1e999` is ordinary digits and an exponent, so it is inside the finite
    // grammar and only the result betrays it. Reaching `sampleCurve`, it
    // multiplies Infinity/NaN into the particle geometry that samples the curve.
    const curve = decodeCurve({ _data: '[Vector2(0, 1e999), 0.0, 0.0, 0, 0]' });

    expect(curve.points).toEqual([]);
    expect(sampleCurve(curve, 0.5)).toBe(0);
  });

  it('drops only the unreadable point, keeping the ones it read (error path)', () => {
    // Dropping all of them left `point_count` free to pad the empty list back
    // up, turning a rejected curve into a confident flat one.
    const curve = decodeCurve({
      _data: '[Vector2(0, 0), 0.0, 0.0, 0, 0, Vector2(0.5, 1e999), 0.0, 0.0, 0, 0, Vector2(1, 1), 0.0, 0.0, 0, 0]',
    });

    expect(curve.points.map((p) => p.position)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it('falls back on a non-finite TANGENT, as it does on a non-finite position', () => {
    const curve = decodeCurve({
      _data: '[Vector2(0, 0), 0.0, inf, 0, 0, Vector2(1, 1), 0.0, 0.0, 0, 0]',
    });

    expect(curve.points[0]!.rightTangent).toBe(0);
    expect(sampleCurve(curve, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('declines a non-finite `_limits` rather than clamping every point onto it', () => {
    const curve = decodeCurve({ _limits: '[inf, 2.0, 0.0, 3.0]', _data: '[Vector2(1, 1), 0.0, 0.0, 0, 0]' });

    expect(curve.minValue).toBe(EMPTY_CURVE.minValue);
    expect(curve.maxValue).toBe(EMPTY_CURVE.maxValue);
  });

  it('narrows a `Vector2i` position to int32, the way the slot conversion does', () => {
    // `slotTupleRegex` admits the spelling on purpose; `_parse_construct<int32_t>`
    // narrows each argument before it widens into the float slot.
    expect(decodeCurve({ _data: '[Vector2i(4294967295, 0), 0.0, 0.0, 0, 0]' }).points[0]!.position).toEqual({
      x: -1,
      y: 0,
    });
  });

  it('returns Godot resource defaults for an empty resource body (edge case)', () => {
    const curve = decodeCurve({});
    expect(curve).toEqual({
      points: [],
      minValue: 0,
      maxValue: 1,
      minDomain: 0,
      maxDomain: 1,
    });
  });

  it('tolerates whitespace and newlines inside the array literal (edge case)', () => {
    const curve = decodeCurve({ _data: '[\n  Vector2( 0 , 0.5 ),\n  1.0,\n  2.0,\n  0,\n  0\n]' });
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
    const curve = decodeCurve({ _data: '[Vector2(1, 1), 0.5, 0.5, 1, 1]', point_count: '3' });

    expect(curve.points).toHaveLength(3);
    expect(curve.points[0]).toEqual(DEFAULT_POINT);
    expect(curve.points[1]).toEqual(DEFAULT_POINT);
    // `leftTangent` is 1, not the written 0.5: `_add_point` ends in
    // `update_auto_tangents` (curve.cpp:100), and a LINEAR endpoint re-aims at
    // the neighbour that just arrived — here the slope from (0,0) to (1,1).
    expect(curve.points[2]).toEqual({
      position: { x: 1, y: 1 },
      leftTangent: 1,
      rightTangent: 0.5,
      leftMode: CurveTangentMode.Linear,
      rightMode: CurveTangentMode.Linear,
    });
  });

  it('re-aims only a LINEAR endpoint, leaving a Free neighbour’s tangent alone', () => {
    const curve = decodeCurve({ _data: '[Vector2(1, 1), 0.5, 0.5, 0, 0]', point_count: '2' });

    expect(curve.points[1]!.leftTangent).toBe(0.5);
    expect(curve.points[1]!.rightTangent).toBe(0.5);
  });

  it('samples the curve Godot samples once the pad has re-aimed the tangent', () => {
    const curve = decodeCurve({ _data: '[Vector2(1, 1), 0.5, 0.5, 1, 1]', point_count: '2' });

    expect(sampleCurve(curve, 0.5)).toBeCloseTo(0.375, 6);
  });

  it('seats a padded point in offset order, so sampling interpolates', () => {
    // One point makes `sampleCurve` answer a constant; the padded point at the
    // domain start gives it a span to interpolate across.
    const curve = decodeCurve({ _data: '[Vector2(1, 1), 0.0, 0.0, 0, 0]', point_count: '2' });

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
    const curve = decodeCurve({ _data: '[Vector2(0, 0.5), 0.0, 0.0, 0, 0]', point_count: '3' });

    expect(curve.points.map((p) => p.position.y)).toEqual([0, 0, 0.5]);
  });

  it('clamps the padded position into the curve’s own ranges', () => {
    const curve = decodeCurve({
      _limits: '[2.0, 5.0, 1.0, 3.0]',
      _data: '[Vector2(3, 4), 0.0, 0.0, 0, 0]',
      point_count: '2',
    });

    expect(curve.points[0]!.position).toEqual({ x: 1, y: 2 });
  });

  it('keeps every decoded point when the count is negative (error path)', () => {
    // `ERR_FAIL_COND(p_count < 0)` returns before touching the point list.
    expect(decodeCurve({ ...CANDLE_SPARKLE, point_count: '-1' }).points).toHaveLength(3);
  });

  it('stops padding at `MAX_PADDED_POINTS` (edge case)', () => {
    const curve = decodeCurve({ ...CANDLE_SPARKLE, point_count: '100000' });

    expect(curve.points).toHaveLength(MAX_PADDED_POINTS);
  });
});

const CURVE_RESOURCE: TscnInternalResource = {
  type: 'Curve',
  id: '1',
  data: { id: '4', ...CANDLE_SPARKLE },
};

describe('resolveCurve', () => {
  it('decodes the Curve a SubResource reference names (happy path)', () => {
    const curve = resolveCurve('SubResource("4")', [CURVE_RESOURCE]);
    expect(curve?.points).toHaveLength(3);
  });

  it('returns null when the reference names a different resource type (error path)', () => {
    const gradient: TscnInternalResource = { type: 'Gradient', id: '2', data: { id: '4' } };
    expect(resolveCurve('SubResource("4")', [gradient])).toBeNull();
  });

  it('returns null for an absent or non-SubResource reference (edge case)', () => {
    expect(resolveCurve(undefined, [CURVE_RESOURCE])).toBeNull();
    expect(resolveCurve('ExtResource("4")', [CURVE_RESOURCE])).toBeNull();
    expect(resolveCurve('SubResource("nope")', [CURVE_RESOURCE])).toBeNull();
  });
});

/** The given properties as a standalone `.tres` file's `[resource]` body. */
function tresFile(type: string, properties: Record<string, string>): string {
  const body = Object.entries(properties)
    .map(([key, value]) => `${key} = ${value}`)
    .join('\n');
  return `[gd_resource type="${type}" format=3 uid="uid://ccurve0"]\n\n[resource]\n${body}\n`;
}

describe('curveFromResource', () => {
  it('decodes a `.tres` body identically to the same properties arriving inline', () => {
    // Both paths are driven from ONE property set, so they cannot drift: the
    // external file's [resource] body and the inline sub-resource's data carry
    // the same keys (the inline block's extra `id` is not a curve property).
    const external = curveFromResource(parseTresFile(tresFile('Curve', CANDLE_SPARKLE)));
    const inline = resolveCurve('SubResource("4")', [CURVE_RESOURCE]);

    expect(external).toEqual(inline);
    expect(external?.points).toHaveLength(3);
    expect(external?.maxValue).toBe(0.3);
  });

  it('returns null for a resource file of some other type (error path)', () => {
    const parsed = parseTresFile(tresFile('Gradient', { offsets: 'PackedFloat32Array(0, 1)' }));
    expect(curveFromResource(parsed)).toBeNull();
  });

  it('decodes an empty `[resource]` body to the Godot defaults (edge case)', () => {
    const parsed = parseTresFile('[gd_resource type="Curve" format=3]\n\n[resource]\n');
    expect(curveFromResource(parsed)).toEqual({
      points: [],
      minValue: 0,
      maxValue: 1,
      minDomain: 0,
      maxDomain: 1,
    });
  });
});

describe('a Variant number Godot reads differently from `parseInt`', () => {
  // `parseInt`/`parseFloat` stop at the first character they cannot use, so an
  // entry Godot refuses outright came back as a plausible number and every
  // sample of the curve was scaled by it.
  it('rejects a `_limits` entry the tokenizer cannot read, rather than truncating it', () => {
    const curve = decodeCurve({ ...CANDLE_SPARKLE, _limits: '[0.0, 5abc, 0.0, 1.0]' });

    // `parseFloat` read `5abc` as 5 and scaled every sample by a maximum the
    // file does not contain. Godot cannot read the token, so the literal is
    // unreadable and the documented fall-back applies.
    expect(curve.maxValue).toBe(EMPTY_CURVE.maxValue);
  });

  it('reads an exponent-typed `point_count` as the integer Godot stores', () => {
    // `2e1` is 20 to Godot's tokenizer and 2 to `parseInt`: the smaller number
    // slices the three-point list down to two, the larger pads it out to 20.
    const curve = decodeCurve({ ...CANDLE_SPARKLE, point_count: '2e1' });

    expect(curve.points).toHaveLength(20);
  });

  it('does not read a tangent mode out of text the tokenizer refuses', () => {
    // `parseInt` read `1abc` as 1 and reported Linear for a token Godot cannot
    // load at all.
    const curve = decodeCurve({ ...CANDLE_SPARKLE, _data: '[Vector2(0, 0), 0.0, 0.0, 1abc, 0]' });

    expect(curve.points[0]!.leftMode).toBe(CurveTangentMode.Free);
  });
});
