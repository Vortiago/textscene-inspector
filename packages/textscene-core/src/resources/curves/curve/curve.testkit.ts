/** Curve builders the Curve and curve-reading tests share. */

import { CurveTangentMode, EMPTY_CURVE, type Curve, type CurvePoint } from './types';

/** A Free point with the given tangents, as `Curve.add_point` makes it when they are 0. */
export function point(x: number, y: number, left = 0, right = 0): CurvePoint {
  return {
    position: { x, y },
    leftTangent: left,
    rightTangent: right,
    leftMode: CurveTangentMode.Free,
    rightMode: CurveTangentMode.Free,
  };
}

export function curveOf(...points: CurvePoint[]): Curve {
  return { ...EMPTY_CURVE, points };
}
