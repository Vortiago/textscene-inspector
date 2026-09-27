/**
 * `Curve.point_count` applied to a decoded point list: what Godot's setter does with
 * the count, apart from how `decode.ts` reads the `_data` literal. No THREE.
 */

import { clamp } from '../../../godot/index.js';
import { MAX_PADDED_POINTS } from '../shared/pointCount';
import { curveIndex } from './sample';
import { CurveTangentMode, type Curve, type CurvePoint } from './types';

/**
 * The point list at the declared count, as `Curve::set_point_count` (curve.cpp:41-57).
 * Godot pads through `_add_point`, which clamps the `Vector2()` position into the
 * curve's ranges (curve.cpp:63-64), seats it in offset order, and re-derives the
 * tangents around it (curve.cpp:100). Tangents are 0, both modes Free (curve.h:152-156).
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
 * before it: the engine's two branches, not one rule.
 */
function addPointIndex(points: readonly CurvePoint[], x: number): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return x > points[0]!.position.x ? 1 : 0;
  const index = curveIndex(points, x);
  return index === 0 && x < points[0]!.position.x ? 0 : index + 1;
}

/**
 * `Curve::update_auto_tangents` (curve.cpp:279-303): a Linear endpoint on either side
 * of `index` re-aims at its new neighbour, and the neighbour at it. The slice reads
 * stored tangents, so padding, the one path that moves a neighbour, owes this update.
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
 * `v.y / v.x` for `v = (from - to).normalized()`, or null for a non-finite slope (two
 * points at one offset, or a vertical span). Godot stores either, but `sampleCurve`
 * would multiply it into the geometry, so the endpoint keeps its old tangent.
 */
function slope(from: CurvePoint, to: CurvePoint): number | null {
  const dx = from.position.x - to.position.x;
  const dy = from.position.y - to.position.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return null;
  const aimed = dy / length / (dx / length);
  return Number.isFinite(aimed) ? aimed : null;
}
