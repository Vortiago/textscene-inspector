/**
 * The connection curve: `GraphEdit::get_connection_line` (`scene/gui/graph_edit.cpp:1523-1542`)
 * and the `Curve2D::tessellate` subdivision it runs (`scene/resources/curve.cpp:846-863,1263-1291`),
 * specialised to the one two-anchor segment that `get_connection_line` builds.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vec2 } from '../../../../r3f/controls/native/rect';

/** `MAX_CONNECTION_LINE_CURVE_TESSELATION_STAGES` (`graph_edit.cpp:54`). */
const MAX_STAGES = 5;
// The `curvature > 0` branch passes tolerance 2 explicitly. The `curvature <= 0` branch keeps
// `tessellate`'s default of 4 degrees (`curve.h:253`).
const CURVED_TOLERANCE_DEG = 2;
const STRAIGHT_TOLERANCE_DEG = 4;

export interface ConnectionCurveControlPoints {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
}

/** `graph_edit.cpp:1523-1533`: the two anchors, plus a horizontal tangent-handle control point on each. */
export function connectionControlPoints(from: Vec2, to: Vec2, curvature: number): ConnectionCurveControlPoints {
  const xDiff = to.x - from.x;
  let cpOffset = xDiff * curvature;
  if (xDiff < 0) cpOffset = -cpOffset;
  return {
    p0: from,
    p1: { x: from.x + cpOffset, y: from.y },
    p2: { x: to.x - cpOffset, y: to.y },
    p3: to,
  };
}

/** `Math::bezier_interpolate` (`core/math/math_funcs.h`), one component. */
function bezierInterpolate(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const omt = 1 - t;
  const omt2 = omt * omt;
  const omt3 = omt2 * omt;
  const t2 = t * t;
  const t3 = t2 * t;
  return p0 * omt3 + 3 * p1 * omt2 * t + 3 * p2 * omt * t2 + p3 * t3;
}

function bezierPoint(cp: ConnectionCurveControlPoints, t: number): Vec2 {
  return {
    x: bezierInterpolate(cp.p0.x, cp.p1.x, cp.p2.x, cp.p3.x, t),
    y: bezierInterpolate(cp.p0.y, cp.p1.y, cp.p2.y, cp.p3.y, t),
  };
}

/** `Vector2::normalized()`: a zero-length vector stays `(0, 0)` (`core/math/vector2.h`). */
function normalized(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

/** `Curve2D::_bake_segment2d` (`curve.cpp:846-863`), specialised to one Bezier segment (`p_a`/`p_b` fixed as `cp.p0`/`cp.p3`). */
function bakeSegment(
  bake: Map<number, Vec2>,
  cp: ConnectionCurveControlPoints,
  begin: number,
  end: number,
  depth: number,
  maxDepth: number,
  toleranceDeg: number
): void {
  const mp = begin + (end - begin) * 0.5;
  const beg = bezierPoint(cp, begin);
  const mid = bezierPoint(cp, mp);
  const fin = bezierPoint(cp, end);

  const na = normalized({ x: mid.x - beg.x, y: mid.y - beg.y });
  const nb = normalized({ x: fin.x - mid.x, y: fin.y - mid.y });
  const dp = na.x * nb.x + na.y * nb.y;
  if (dp < Math.cos((toleranceDeg * Math.PI) / 180)) {
    bake.set(mp, mid);
  }

  if (depth < maxDepth) {
    bakeSegment(bake, cp, begin, mp, depth + 1, maxDepth, toleranceDeg);
    bakeSegment(bake, cp, mp, end, depth + 1, maxDepth, toleranceDeg);
  }
}

/**
 * `curve.tessellate(5, 2.0)` for `curvature > 0`, else `curve.tessellate(1)`
 * (`graph_edit.cpp:1538-1541`): the polyline points `Line2D::set_points` receives,
 * anchors included.
 */
export function tessellateConnectionLine(cp: ConnectionCurveControlPoints, curvature: number): Vec2[] {
  const maxDepth = curvature > 0 ? MAX_STAGES : 1;
  const toleranceDeg = curvature > 0 ? CURVED_TOLERANCE_DEG : STRAIGHT_TOLERANCE_DEG;
  const bake = new Map<number, Vec2>();
  bakeSegment(bake, cp, 0, 1, 0, maxDepth, toleranceDeg);
  const sortedKeys = [...bake.keys()].sort((a, b) => a - b);
  return [cp.p0, ...sortedKeys.map((k) => bake.get(k)!), cp.p3];
}
