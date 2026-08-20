/**
 * `Curve.point_count` applied to a decoded point list.
 *
 * A sibling of `decode.ts` rather than part of it: this is what Godot's SETTER
 * does with the count, not how the `_data` literal is read.
 *
 * Pure `.ts`, no THREE.
 */

import { curveIndex } from './sample';
import { CurveTangentMode, type Curve, type CurvePoint } from './types';

/**
 * A previewer must not hang a tab. Godot has no such cap — `point_count` is an
 * unbounded int — but each padded point is seated in order, so a count in the
 * millions is quadratic work before the first paint.
 */
export const MAX_PADDED_POINTS = 4096;

/**
 * The point list at the declared count — `Curve::set_point_count`
 * (curve.cpp:41-57). Past the decoded length Godot pads through `_add_point`,
 * which clamps the `Vector2()` position into the curve's own ranges
 * (curve.cpp:63-64) and seats it in offset order, so the list stays sorted for
 * `sampleCurve`'s search. Tangents are 0 and both modes Free (curve.h:152-156).
 */
export function resizePoints(curve: Curve, count: number): CurvePoint[] {
  const points = curve.points.slice(0, count);
  const x = clamp(0, curve.minDomain, curve.maxDomain);
  const y = clamp(0, curve.minValue, curve.maxValue);
  while (points.length < count && points.length < MAX_PADDED_POINTS) {
    points.splice(addPointIndex(points, x), 0, {
      position: { x, y },
      leftTangent: 0,
      rightTangent: 0,
      leftMode: CurveTangentMode.Free,
      rightMode: CurveTangentMode.Free,
    });
  }
  return points;
}

/**
 * Where `_add_point` seats a point of that offset (curve.cpp:66-98). A lone
 * existing point of equal offset ends up after the new one, any later one
 * before it — the engine's two branches, not one rule.
 */
function addPointIndex(points: readonly CurvePoint[], x: number): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return x > points[0]!.position.x ? 1 : 0;
  const index = curveIndex(points, x);
  return index === 0 && x < points[0]!.position.x ? 0 : index + 1;
}

/** `CLAMP` (typedefs.h:138-141). */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
