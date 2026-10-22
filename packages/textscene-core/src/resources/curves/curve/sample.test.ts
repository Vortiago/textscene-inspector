import { describe, expect, it } from 'vitest';
import { resolveOnlySubResource } from '../../../testing/subResource';
import { resolveCurve } from './decode';
import { sampleCurve } from './sample';
import { CurveTangentMode, EMPTY_CURVE, type Curve, type CurvePoint } from './types';

function point(x: number, y: number, left = 0, right = 0): CurvePoint {
  return {
    position: { x, y },
    leftTangent: left,
    rightTangent: right,
    leftMode: CurveTangentMode.Free,
    rightMode: CurveTangentMode.Free,
  };
}

function curveOf(...points: CurvePoint[]): Curve {
  return { ...EMPTY_CURVE, points };
}

describe('sampleCurve', () => {
  it('interpolates a flat-tangent span as Godot’s cubic Bézier (happy path)', () => {
    // Control points at y and y' give bezier(0, 0, 1, 1, t) = 3t^2 - 2t^3.
    const curve = curveOf(point(0, 0), point(1, 1));
    expect(sampleCurve(curve, 0.5)).toBeCloseTo(0.5, 10);
    expect(sampleCurve(curve, 0.25)).toBeCloseTo(0.15625, 10);
    expect(sampleCurve(curve, 0.75)).toBeCloseTo(0.84375, 10);
  });

  it('reproduces a straight line when both tangents match the slope', () => {
    const curve = curveOf(point(0, 0, 0, 1), point(1, 1, 1, 0));
    expect(sampleCurve(curve, 0.25)).toBeCloseTo(0.25, 10);
    // 0.6 is a float offset, 0.60000002.
    expect(sampleCurve(curve, 0.6)).toBeCloseTo(0.6, 6);
  });

  it('returns the endpoint value exactly at each authored point', () => {
    const [low, middle, high] = [0.2, 0.9, 0.1].map(Math.fround) as [number, number, number];
    const curve = curveOf(point(0, low), point(0.5, middle), point(1, high));
    expect(sampleCurve(curve, 0)).toBe(low);
    expect(sampleCurve(curve, 0.5)).toBe(middle);
    expect(sampleCurve(curve, 1)).toBe(high);
  });

  it('picks the span an offset falls in across three points', () => {
    const curve = curveOf(point(0, 0), point(0.5, 1), point(1, 0));
    expect(sampleCurve(curve, 0.25)).toBeGreaterThan(0);
    expect(sampleCurve(curve, 0.25)).toBeLessThan(1);
    expect(sampleCurve(curve, 0.75)).toBeGreaterThan(0);
    expect(sampleCurve(curve, 0.75)).toBeLessThan(1);
  });

  it('clamps below the first point and above the last (edge case)', () => {
    const curve = curveOf(point(0.2, 0.4), point(0.8, 0.9));
    expect(sampleCurve(curve, -5)).toBeCloseTo(0.4, 10);
    expect(sampleCurve(curve, 0)).toBeCloseTo(0.4, 10);
    expect(sampleCurve(curve, 5)).toBeCloseTo(0.9, 10);
  });

  it('answers 0 for a curve with no points (error path)', () => {
    expect(sampleCurve(EMPTY_CURVE, 0.5)).toBe(0);
  });

  it('answers the single point’s value for a one-point curve (edge case)', () => {
    expect(sampleCurve(curveOf(point(0.3, 0.7)), 0.9)).toBe(0.7);
  });

  it('answers the right-hand value across a zero-width span (edge case)', () => {
    expect(sampleCurve(curveOf(point(0.5, 0.1), point(0.5, 0.8)), 0.5)).toBeCloseTo(0.1, 10);
  });

  it('overshoots past a control point exactly as the Bézier form does', () => {
    // Steep tangents on the decaying span lift the control points above both of its
    // endpoints, so the sampled value at 0.6 exceeds the 0.188 it decays from. A
    // Hermite reading of the same tangents would not.
    const curve = curveOf(
      point(0, 0, 0, 1.36377),
      point(0.262376, 0.188182, 0.41974, 0.41974),
      point(1, 0.0295454, -1.06101, 0)
    );
    expect(sampleCurve(curve, 0)).toBeCloseTo(0, 10);
    expect(sampleCurve(curve, 0.262376)).toBeCloseTo(0.188182, 6);
    expect(sampleCurve(curve, 1)).toBeCloseTo(0.0295454, 6);
    expect(sampleCurve(curve, 0.6)).toBeCloseTo(0.2494899, 6);
    // Still within the resource's own authored `_limits` ceiling of 0.3.
    expect(sampleCurve(curve, 0.6)).toBeLessThan(0.3);
  });
});

describe('sampleCurve in single precision', () => {
  // Godot 4.6.3 prints each value to 14 digits: its `real_t` is a float, so the points, the offset
  // and every step of the Bézier round to single precision, and rounding the print recovers the float.
  const WAVE = resolveOnlySubResource(
    'Curve',
    {
      _data:
        '[Vector2(0, 0.3), 0.0, 0.5, 0, 0, Vector2(0.5, 1), 0.2, -0.4, 0, 0, Vector2(1, 0), -1.0, 0.0, 0, 0]',
    },
    resolveCurve
  )!;
  const SPARKLE = resolveOnlySubResource(
    'Curve',
    {
      _data:
        '[Vector2(0, 0), 0.0, 1.36377, 0, 0, Vector2(0.262376, 0.188182), 0.41974, 0.41974, 0, 0, ' +
        'Vector2(1, 0.0295454), -1.06101, 0.0, 0, 0]',
    },
    resolveCurve
  )!;

  it.each([
    [0.1, 0.40160003304482],
    [0.2, 0.57280004024506],
    [0.3, 0.76319998502731],
    [0.6, 0.88639998435974],
    [0.77, 0.48434323072433],
    [0.9, 0.16160005331039],
  ])('answers the float Godot answers for a wave at %s', (offset, godot) => {
    expect(sampleCurve(WAVE, offset)).toBe(Math.fround(godot));
  });

  it.each([
    [0.1, 0.10350157320499],
    [0.2, 0.16153462231159],
    [0.3, 0.20314058661461],
    [0.6, 0.24948988854885],
    [0.77, 0.2024884223938],
    [0.9, 0.12170351296663],
  ])('answers the float Godot answers for a particle curve at %s', (offset, godot) => {
    expect(sampleCurve(SPARKLE, offset)).toBe(Math.fround(godot));
  });
});
