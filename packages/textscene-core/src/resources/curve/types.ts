/**
 * Godot's 1D `Curve` resource — a polyline of points with per-side tangents,
 * sampled as a cubic Bézier between consecutive points.
 *
 * Not to be confused with `resources/shapes/curve2d.ts` / `curve3d.ts`, which
 * decode `Curve2D`/`Curve3D` PATH geometry. This one is the scalar
 * `f(offset) -> value` curve that particle parameters, `CurveTexture` and the
 * editor's curve widget all use.
 *
 * Pure data — no THREE — so parser and linter paths can both read it.
 */

/** Godot `Curve.TangentMode`. */
export enum CurveTangentMode {
  /** The stored tangent is authored freely. */
  Free = 0,
  /** The tangent is kept pointing at the neighbouring point (Godot keeps the
   *  stored value in sync, so sampling reads it the same way as Free). */
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
  /** `_limits[0]` — the editor's vertical minimum. Not applied by `sampleCurve`. */
  minValue: number;
  /** `_limits[1]` — the editor's vertical maximum. Not applied by `sampleCurve`. */
  maxValue: number;
  /** `_limits[2]` — the horizontal domain start (Godot 4.3+; older files omit it). */
  minDomain: number;
  /** `_limits[3]` — the horizontal domain end (Godot 4.3+; older files omit it). */
  maxDomain: number;
}

/** A `Curve` with no points — Godot's `sample()` answers 0 for it. */
export const EMPTY_CURVE: Curve = {
  points: [],
  minValue: 0,
  maxValue: 1,
  minDomain: 0,
  maxDomain: 1,
};
