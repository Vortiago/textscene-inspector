/**
 * Evaluate a Godot `Curve` at an offset.
 *
 * Godot draws the span between two points as a cubic Bézier whose two control
 * points sit a THIRD of the span apart horizontally, lifted by the authored
 * tangents — not as a Hermite spline, even though the two are algebraically the
 * same family. Reproducing the Bézier form keeps the arithmetic identical to
 * the engine's rather than merely equivalent in exact maths.
 *
 * ---------------------------------------------------------------------------
 * Derived from Godot Engine (`scene/resources/curve.cpp`, `Curve::sample`,
 * `Curve::sample_local_nocheck`, `Curve::get_index`, and
 * `Math::bezier_interpolate`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * See THIRD-PARTY-NOTICES.md.
 * ---------------------------------------------------------------------------
 */

import type { Curve, CurvePoint } from './types';
import { CMP_EPSILON } from '../../../godot/index.js';


/**
 * `Curve::sample` — the value at `offset`. Out-of-range offsets clamp to the
 * first/last point's value; an empty curve answers 0, which is what a caller
 * that treats a missing curve as "no curve" must NOT confuse with a flat 1.
 */
export function sampleCurve(curve: Curve, offset: number): number {
  const points = curve.points;
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0]!.position.y;

  const index = curveIndex(points, offset);
  if (index === points.length - 1) return points[index]!.position.y;

  const local = offset - points[index]!.position.x;
  if (index === 0 && local <= 0) return points[0]!.position.y;

  return sampleLocalNoCheck(points, index, local);
}

/**
 * `Curve::get_index` — a lower-bound binary search for the span containing
 * `offset`. Answers the LAST index when the offset is past the end and 0 when
 * it is before the start, so `sample` can clamp on both sides.
 *
 * Exported because `decode.ts` seats a padded point through the same search
 * `Curve::_add_point` uses.
 */
export function curveIndex(points: readonly CurvePoint[], offset: number): number {
  let imin = 0;
  let imax = points.length - 1;

  while (imax - imin > 1) {
    const middle = (imin + imax) >> 1;
    const a = points[middle]!.position.x;
    const b = points[middle + 1]!.position.x;
    if (a < offset && b < offset) imin = middle;
    else if (a > offset) imax = middle;
    else return middle;
  }

  return offset > points[imax]!.position.x ? imax : imin;
}

/**
 * `Curve::sample_local_nocheck` — the span between `index` and `index + 1`,
 * `localOffset` measured from the left point in curve units (not normalised).
 */
function sampleLocalNoCheck(
  points: readonly CurvePoint[],
  index: number,
  localOffset: number
): number {
  const a = points[index]!;
  const b = points[index + 1]!;

  let d = b.position.x - a.position.x;
  if (Math.abs(d) < CMP_EPSILON) return b.position.y;

  const t = localOffset / d;
  // The control points are placed at a third of the span; the tangents are
  // slopes, so the vertical lift is `slope * (span / 3)`.
  d /= 3;
  const yac = a.position.y + d * a.rightTangent;
  const ybc = b.position.y - d * b.leftTangent;

  return bezierInterpolate(a.position.y, yac, ybc, b.position.y, t);
}

/** `Math::bezier_interpolate` — the scalar cubic Bézier. */
function bezierInterpolate(
  start: number,
  control1: number,
  control2: number,
  end: number,
  t: number
): number {
  const omt = 1 - t;
  const omt2 = omt * omt;
  const omt3 = omt2 * omt;
  const t2 = t * t;
  const t3 = t2 * t;
  return start * omt3 + control1 * omt2 * t * 3 + control2 * omt * t2 * 3 + end * t3;
}
