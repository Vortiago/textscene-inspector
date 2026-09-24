/**
 * Godot's 1D `Curve` resource: the scalar `f(offset) -> value` curve of particle
 * parameters and `CurveTexture`, sampled as a cubic Bézier between points. The
 * `curve2d` and `curve3d` slices decode path geometry. No THREE, so the linter reads it.
 */

/** Godot `Curve.TangentMode`. */
export enum CurveTangentMode {
  /** The stored tangent is authored freely. */
  Free = 0,
  /** The tangent points at the neighbouring point. Godot keeps the stored value in sync, so sampling reads it as Free. */
  Linear = 1,
}

/** One `_data` entry: a position plus the two tangents meeting at it. */
export interface CurvePoint {
  position: { x: number; y: number };
  leftTangent: number;
  rightTangent: number;
  leftMode: CurveTangentMode;
  rightMode: CurveTangentMode;
}

export interface Curve {
  /** Points in authored order (Godot keeps `_data` sorted by `position.x`). */
  points: CurvePoint[];
  /** `_limits[0]`: the editor's vertical minimum. Not applied by `sampleCurve`. */
  minValue: number;
  /** `_limits[1]`: the editor's vertical maximum. Not applied by `sampleCurve`. */
  maxValue: number;
  /** `_limits[2]`: the horizontal domain start (Godot 4.3+, older files omit it). */
  minDomain: number;
  /** `_limits[3]`: the horizontal domain end (Godot 4.3+, older files omit it). */
  maxDomain: number;
}

/** A `Curve` with no points, for which Godot's `sample()` answers 0. */
export const EMPTY_CURVE: Curve = {
  points: [],
  minValue: 0,
  maxValue: 1,
  minDomain: 0,
  maxDomain: 1,
};
