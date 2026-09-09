/**
 * `Curve.point_count` applied to a decoded point list.
 *
 * A sibling of `decode.ts` rather than part of it: this is what Godot's SETTER
 * does with the count, not how the `_data` literal is read.
 *
 * Pure `.ts`, no THREE.
 */

import { clamp } from '../../../godot/index.js';
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
 * (curve.cpp:63-64), seats it in offset order so the list stays sorted for
 * `sampleCurve`'s search, and then re-derives the tangents around it
 * (curve.cpp:100). Tangents are 0 and both modes Free (curve.h:152-156).
 */
export function resizePoints(curve: Curve, count: number): CurvePoint[] {
  // `old_size == p_count` returns before touching the list (curve.cpp:43-46),
  // which is the shape Godot's own writer emits.
  if (count === curve.points.length) return curve.points;

  const points = curve.points.slice(0, count);
  const x = clamp(0, curve.minDomain, curve.maxDomain);
  const y = clamp(0, curve.minValue, curve.maxValue);
  while (points.length < count && points.length < MAX_PADDED_POINTS) {
    const at = addPointIndex(points, x);
    points.splice(at, 0, {
      position: { x, y },
      leftTangent: 0,
      rightTangent: 0,
      leftMode: CurveTangentMode.Free,
      rightMode: CurveTangentMode.Free,
    });
    updateAutoTangents(points, at);
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

/**
 * `Curve::update_auto_tangents` (curve.cpp:279-303) — a LINEAR endpoint on
 * either side of `index` re-aims at its new neighbour.
 *
 * The slice reads a stored tangent rather than recomputing one because Godot
 * keeps the two in sync; padding is the one path that moves a neighbour, so it
 * owes the same update. Both arms of each side run: the seated point re-aims at
 * the neighbour, and the neighbour re-aims at it.
 */
function updateAutoTangents(points: CurvePoint[], index: number): void {
  const point = points[index]!;

  if (index > 0) {
    const before = points[index - 1]!;
    const aimed = slope(before, point);
    if (aimed !== null) {
      if (point.leftMode === CurveTangentMode.Linear) point.leftTangent = aimed;
      if (before.rightMode === CurveTangentMode.Linear) before.rightTangent = aimed;
    }
  }

  if (index + 1 < points.length) {
    const after = points[index + 1]!;
    const aimed = slope(after, point);
    if (aimed !== null) {
      if (point.rightMode === CurveTangentMode.Linear) point.rightTangent = aimed;
      if (after.leftMode === CurveTangentMode.Linear) after.leftTangent = aimed;
    }
  }
}

/**
 * `v.y / v.x` for `v = (from - to).normalized()`, or null when that is not a
 * number this renderer can sample.
 *
 * Two points at one offset normalize to the zero vector and divide 0 by 0; a
 * vertical span divides by 0. Godot stores either, and `sampleCurve` would
 * multiply it into the geometry that samples the curve, so the endpoint keeps
 * the tangent it had instead — the fall-back a non-finite `_data` tangent
 * already takes.
 */
function slope(from: CurvePoint, to: CurvePoint): number | null {
  const dx = from.position.x - to.position.x;
  const dy = from.position.y - to.position.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return null;
  const aimed = dy / length / (dx / length);
  return Number.isFinite(aimed) ? aimed : null;
}
