import { describe, expect, it } from 'vitest';
import { CURVE2D_DATA, CURVE3D_DATA, bezierRefusalProblem, readBezierData } from './bezierData';

describe('readBezierData', () => {
  it('loads a whole number of control points in each spelling, with its points text', () => {
    expect(readBezierData('{"points": PackedVector2Array()}', CURVE2D_DATA)).toEqual({
      refusal: null,
      loaded: { points: 'PackedVector2Array()', controlPoints: 0 },
    });
    expect(readBezierData('{"points": PackedVector2Array(0, 0, 0, 0, 1, 2)}', CURVE2D_DATA)).toEqual({
      refusal: null,
      loaded: { points: 'PackedVector2Array(0, 0, 0, 0, 1, 2)', controlPoints: 1 },
    });
    const bare = '[Vector2(0, 0), Vector2(0, 0), Vector2(1, 2)]';
    expect(readBezierData(`{"points": ${bare}}`, CURVE2D_DATA)).toEqual({
      refusal: null,
      loaded: { points: bare, controlPoints: 1 },
    });
  });

  it('refuses a missing "points", and a Curve3D missing "tilts" (curve.cpp:1239, 2279-2280)', () => {
    expect(readBezierData('{}', CURVE2D_DATA).refusal).toEqual({ kind: 'missing-key', key: 'points' });
    expect(readBezierData('{"points": PackedVector2Array(1, 2)}', CURVE3D_DATA).refusal).toEqual({
      kind: 'missing-key',
      key: 'points',
    });
    expect(readBezierData('{"points": PackedVector3Array()}', CURVE3D_DATA).refusal).toEqual({
      kind: 'missing-key',
      key: 'tilts',
    });
  });

  it('refuses a partial control point, counting floats (curve.cpp:1243, 2284)', () => {
    expect(readBezierData('{"points": PackedVector2Array(0, 0, 0, 0)}', CURVE2D_DATA).refusal).toEqual({
      kind: 'partial-point',
      floats: 4,
    });
    expect(readBezierData('{"points": [Vector3(0, 0, 0)], "tilts": []}', CURVE3D_DATA).refusal).toEqual({
      kind: 'partial-point',
      floats: 3,
    });
  });

  it('drops a trailing partial vector before it counts control points (edge case)', () => {
    const read = readBezierData('{"points": PackedVector2Array(0, 0, 0, 0, 10, 20, 5)}', CURVE2D_DATA);
    expect(read.refusal).toBeNull();
    expect(read.refusal === null && read.loaded.controlPoints).toBe(1);
  });

  it('checks "points" before "tilts", as `_set_data` does (edge case)', () => {
    expect(readBezierData('{}', CURVE3D_DATA).refusal).toEqual({ kind: 'missing-key', key: 'points' });
  });
});

describe('bezierRefusalProblem', () => {
  it('names the missing key, the class and the zero-point consequence', () => {
    const problem = bezierRefusalProblem({ kind: 'missing-key', key: 'tilts' }, CURVE3D_DATA);
    expect(problem).toContain('its Curve3D has no "tilts"');
    expect(problem).toContain('curve.cpp:2279-2284');
    expect(problem).toContain('zero points');
  });

  it("names the float count and the class's floats per control point", () => {
    const problem = bezierRefusalProblem({ kind: 'partial-point', floats: 10 }, CURVE2D_DATA);
    expect(problem).toContain('its Curve2D "points" holds 10 floats');
    expect(problem).toContain('6 floats each');
  });
});
