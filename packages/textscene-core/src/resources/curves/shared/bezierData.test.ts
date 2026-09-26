import { describe, expect, it } from 'vitest';
import { CURVE2D_DATA, CURVE3D_DATA, bezierDataRefusal, bezierPointsLiteral } from './bezierData';

describe('bezierPointsLiteral', () => {
  it('returns the "points" value text', () => {
    expect(bezierPointsLiteral('{"points": PackedVector2Array(1, 2)}', CURVE2D_DATA)).toBe(
      'PackedVector2Array(1, 2)'
    );
  });

  it('returns null when "points" is absent or of another packed type', () => {
    expect(bezierPointsLiteral('{}', CURVE2D_DATA)).toBeNull();
    expect(bezierPointsLiteral('{"points": PackedVector3Array(1, 2, 3)}', CURVE2D_DATA)).toBeNull();
  });
});

describe('bezierDataRefusal', () => {
  it('accepts a whole number of control points in each spelling', () => {
    expect(bezierDataRefusal('{"points": PackedVector2Array()}', CURVE2D_DATA)).toBeNull();
    expect(bezierDataRefusal('{"points": PackedVector2Array(0, 0, 0, 0, 1, 2)}', CURVE2D_DATA)).toBeNull();
    expect(
      bezierDataRefusal('{"points": [Vector2(0, 0), Vector2(0, 0), Vector2(1, 2)]}', CURVE2D_DATA)
    ).toBeNull();
  });

  it('refuses a missing "points", and a Curve3D missing "tilts" (curve.cpp:1239, 2279-2280)', () => {
    expect(bezierDataRefusal('{}', CURVE2D_DATA)).toEqual({ kind: 'missing-key', key: 'points' });
    expect(bezierDataRefusal('{"tilts": PackedFloat32Array()}', CURVE3D_DATA)).toEqual({
      kind: 'missing-key',
      key: 'points',
    });
    expect(bezierDataRefusal('{"points": PackedVector3Array()}', CURVE3D_DATA)).toEqual({
      kind: 'missing-key',
      key: 'tilts',
    });
  });

  it('refuses a partial control point, counting floats (curve.cpp:1243, 2284)', () => {
    expect(bezierDataRefusal('{"points": PackedVector2Array(0, 0, 0, 0)}', CURVE2D_DATA)).toEqual({
      kind: 'partial-point',
      floats: 4,
    });
    expect(
      bezierDataRefusal('{"points": [Vector3(0, 0, 0)], "tilts": []}', CURVE3D_DATA)
    ).toEqual({ kind: 'partial-point', floats: 3 });
  });

  it('checks "points" before "tilts", as `_set_data` does (edge case)', () => {
    expect(bezierDataRefusal('{}', CURVE3D_DATA)).toEqual({ kind: 'missing-key', key: 'points' });
  });
});
