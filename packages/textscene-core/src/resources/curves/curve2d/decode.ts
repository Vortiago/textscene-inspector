/**
 * Curve2D decode: `_data = { "points": PackedVector2Array(...) }`, six floats per
 * point (`in.x, in.y, out.x, out.y, position.x, position.y`, handles relative to the
 * position), to control points and a tessellated polyline. No THREE: coordinates
 * stay in Godot 2D space (+Y down).
 */

import type { TscnInternalResource } from '../../../parser/types';
import { parsePackedVector2Array } from '../../shapes/packedArray';
import { bezierInterpolate } from '../../../godot/index.js';
import { CURVE2D_DATA } from '../shared/bezierData';
import { decodeBezierCurve, resolveBezierCurve, type BezierCurveReader } from '../shared/bezierCurve';
import type {
  Curve2DControlPoint,
  Curve2DSample,
  Curve2DSampler,
} from './types';

const CURVE2D: BezierCurveReader<Curve2DControlPoint> = {
  format: CURVE2D_DATA,
  parse: parsePackedVector2Array,
  pointAt: (flat, base) => ({
    in: { x: flat[base + 0]!, y: flat[base + 1]! },
    out: { x: flat[base + 2]!, y: flat[base + 3]! },
    position: { x: flat[base + 4]!, y: flat[base + 5]! },
  }),
  origin: () => ({ in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, position: { x: 0, y: 0 } }),
};

/** The control points of a Curve2D resource body, as Godot loads them. */
export function decodeCurve2D(data: Readonly<Record<string, unknown>>): Curve2DControlPoint[] {
  return decodeBezierCurve(data, CURVE2D);
}

/** The control points of the Curve2D a `SubResource("id")` value names, or none. */
export function resolveCurve2D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): Curve2DControlPoint[] {
  return resolveBezierCurve(ref, internalResources, CURVE2D);
}

/**
 * Tessellate control points into a polyline sampler. Straight spans (both
 * tangents zero) become a single segment; curved spans are subdivided into
 * `segmentsPerSpan` cubic-Bézier steps. Degenerate input (0 or 1 points) yields
 * a zero-length sampler that still reports the lone point's position.
 */
export function tessellateCurve2D(
  points: Curve2DControlPoint[],
  segmentsPerSpan = 16
): Curve2DSampler {
  const flat: number[] = [];
  if (points.length > 0) {
    const first = points[0]!.position;
    flat.push(first.x, first.y);
    for (let i = 0; i + 1 < points.length; i++) {
      appendSpan(flat, points[i]!, points[i + 1]!, segmentsPerSpan);
    }
  }

  // Cumulative arc length per polyline vertex (cum[0] = 0).
  const vertexCount = flat.length / 2;
  const cum: number[] = new Array(vertexCount).fill(0);
  for (let i = 1; i < vertexCount; i++) {
    const dx = flat[i * 2]! - flat[(i - 1) * 2]!;
    const dy = flat[i * 2 + 1]! - flat[(i - 1) * 2 + 1]!;
    cum[i] = cum[i - 1]! + Math.hypot(dx, dy);
  }
  const length = vertexCount > 0 ? cum[vertexCount - 1]! : 0;

  function sampleAt(distance: number): Curve2DSample {
    if (vertexCount === 0) return { x: 0, y: 0, angle: 0 };
    if (vertexCount === 1) return { x: flat[0]!, y: flat[1]!, angle: 0 };
    const d = Math.max(0, Math.min(length, distance));
    // Find the segment [i, i+1] whose cumulative span contains d.
    let i = 1;
    while (i < vertexCount && cum[i]! < d) i++;
    const i0 = i - 1;
    const i1 = Math.min(i, vertexCount - 1);
    const segLen = cum[i1]! - cum[i0]!;
    const t = segLen > 0 ? (d - cum[i0]!) / segLen : 0;
    const x0 = flat[i0 * 2]!;
    const y0 = flat[i0 * 2 + 1]!;
    const x1 = flat[i1 * 2]!;
    const y1 = flat[i1 * 2 + 1]!;
    return {
      x: x0 + (x1 - x0) * t,
      y: y0 + (y1 - y0) * t,
      angle: Math.atan2(y1 - y0, x1 - x0),
    };
  }

  return { points: flat, length, sampleAt };
}

/**
 * Append a span's vertices (excluding its start, already pushed) to `flat`. The span
 * is the cubic Bézier `P0=pos_i, P1=pos_i+out_i, P2=pos_{i+1}+in_{i+1}, P3=pos_{i+1}`.
 */
function appendSpan(
  flat: number[],
  a: Curve2DControlPoint,
  b: Curve2DControlPoint,
  segmentsPerSpan: number
): void {
  const straight =
    a.out.x === 0 && a.out.y === 0 && b.in.x === 0 && b.in.y === 0;
  if (straight) {
    flat.push(b.position.x, b.position.y);
    return;
  }
  const p0 = a.position;
  const p1 = { x: a.position.x + a.out.x, y: a.position.y + a.out.y };
  const p2 = { x: b.position.x + b.in.x, y: b.position.y + b.in.y };
  const p3 = b.position;
  const steps = Math.max(1, segmentsPerSpan);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    flat.push(bezierInterpolate(p0.x, p1.x, p2.x, p3.x, t), bezierInterpolate(p0.y, p1.y, p2.y, p3.y, t));
  }
}
