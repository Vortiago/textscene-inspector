/**
 * The expected values are what Godot 4.6.3 prints for `Curve.sample_baked` on the same curves
 * (a headless script that adds the points and sets `bake_resolution` and the domain).
 */

import { describe, expect, it } from 'vitest';
import { bakedCurveSampler } from './bakedSample';
import { CurveTangentMode, EMPTY_CURVE, type Curve, type CurvePoint } from './types';

function point(x: number, y: number): CurvePoint {
  return {
    position: { x, y },
    leftTangent: 0,
    rightTangent: 0,
    leftMode: CurveTangentMode.Free,
    rightMode: CurveTangentMode.Free,
  };
}

/** Two points as `Curve.add_point` makes them: Free, with no tangent. */
const SHRINKING: Curve = { ...EMPTY_CURVE, points: [point(0, 1), point(1, 0.2)] };

function expectSamples(curve: Curve, cases: ReadonlyArray<readonly [offset: number, godot: number]>): void {
  const sample = bakedCurveSampler(curve);
  for (const [offset, godot] of cases) expect(sample(offset), `offset ${offset}`).toBeCloseTo(godot, 6);
}

describe('bakedCurveSampler', () => {
  it("returns the first and last point's value at the domain ends", () => {
    expectSamples(SHRINKING, [
      [0, 1],
      [1, 0.2],
    ]);
  });

  it('reads a cache entry, which Curve.sample baked, not the curve between two entries', () => {
    // Offset 0.5 sits between entries 49 and 50 of 100 and takes their lerp.
    expectSamples(SHRINKING, [[0.5, 0.60000002384186]]);
  });

  it('lerps between two cache entries, so it differs from Curve.sample', () => {
    expectSamples(SHRINKING, [
      [0.25, 0.87497705221176],
      [0.123456, 0.96639961004257],
      [0.995, 0.20012040436268],
    ]);
  });

  it('bakes the number of entries `bake_resolution` names', () => {
    expectSamples({ ...SHRINKING, bakeResolution: 3 }, [
      [0.25, 0.79999995231628],
      [0.995, 0.2039999961853],
    ]);
  });

  it('bakes only the two ends at a `bake_resolution` of 2', () => {
    expectSamples({ ...SHRINKING, bakeResolution: 2 }, [
      [0.5, 0.60000002384186],
      [0.123456, 0.90123522281647],
    ]);
  });

  it('maps the offset over the curve domain, and clamps outside it', () => {
    const wide: Curve = {
      ...EMPTY_CURVE,
      minDomain: -1,
      maxDomain: 3,
      points: [point(-1, 0.3), point(0.5, 1), point(3, 0.1)],
    };

    expectSamples(wide, [
      [-1, 0.30000001192092896],
      [0, 0.81842583417892],
      [1.7, 0.5769807100296],
      [3, 0.10000000149012],
      [4, 0.10000000149012],
      [-2, 0.30000001192092896],
    ]);
  });

  it("answers the last point's value for a one-entry cache, which the bake writes last", () => {
    expectSamples({ ...SHRINKING, bakeResolution: 1 }, [[0.5, 0.20000000298023]]);
  });

  it('answers 0 for a curve with no points', () => {
    expect(bakedCurveSampler(EMPTY_CURVE)(0.5)).toBe(0);
  });
});
