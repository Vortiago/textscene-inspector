/**
 * Curve3D decode: `_data = { "points": PackedVector3Array(...), "tilts": ... }`, nine
 * floats per point (`in.xyz, out.xyz, position.xyz`, handles relative to the
 * position), to control points and a tessellated polyline. `tilts` is ignored. No
 * THREE: Godot 3D space is right-handed Y-up, as three.js is.
 */

import { parsePackedVector3Array } from '../../shapes/packedArray';
import type {
  Curve3DControlPoint,
  Curve3DSample,
  Curve3DSampler,
} from './types';
import { dictPackedField } from '../../../godot/packedArrayFields.js';

const FLOATS_PER_POINT = 9;

/**
 * Parse a Curve3D `_data` value into control points. Accepts the raw TSCN string
 * (`{ "points": PackedVector3Array(...), … }`) or, defensively, an object with a
 * `points` string. A trailing partial point is dropped. Returns `[]` for
 * missing/empty/malformed input.
 */
export function parseCurve3DPoints(dataValue: unknown): Curve3DControlPoint[] {
  const literal = extractPointsLiteral(dataValue);
  if (!literal) return [];

  let flat: Float32Array;
  try {
    flat = parsePackedVector3Array(literal);
  } catch {
    return [];
  }

  const count = Math.floor(flat.length / FLOATS_PER_POINT);
  const points: Curve3DControlPoint[] = [];
  for (let i = 0; i < count; i++) {
    const b = i * FLOATS_PER_POINT;
    points.push({
      in: { x: flat[b + 0]!, y: flat[b + 1]!, z: flat[b + 2]! },
      out: { x: flat[b + 3]!, y: flat[b + 4]!, z: flat[b + 5]! },
      position: { x: flat[b + 6]!, y: flat[b + 7]!, z: flat[b + 8]! },
    });
  }
  return points;
}

/** Built once: a non-global instance carries no `lastIndex`, so it is safe to share. */
const POINTS_FIELD_RE = dictPackedField('points', 'PackedVector3Array');

/**
 * The `points` value out of a `_data` string or object, in whichever of the
 * three spellings `parsePackedVector3Array` takes.
 */
function extractPointsLiteral(dataValue: unknown): string | null {
  if (typeof dataValue === 'string') return POINTS_FIELD_RE.exec(dataValue)?.[1] ?? null;
  if (dataValue && typeof dataValue === 'object') {
    const points = (dataValue as { points?: unknown }).points;
    return typeof points === 'string' ? points : null;
  }
  return null;
}

/**
 * Tessellate control points into a polyline sampler. Straight spans (both
 * tangents zero) become a single segment; curved spans are subdivided into
 * `segmentsPerSpan` cubic-Bézier steps. Degenerate input (0 or 1 points) yields
 * a zero-length sampler that still reports the lone point's position.
 */
export function tessellateCurve3D(
  points: Curve3DControlPoint[],
  segmentsPerSpan = 16
): Curve3DSampler {
  const flat: number[] = [];
  if (points.length > 0) {
    const first = points[0]!.position;
    flat.push(first.x, first.y, first.z);
    for (let i = 0; i + 1 < points.length; i++) {
      appendSpan(flat, points[i]!, points[i + 1]!, segmentsPerSpan);
    }
  }

  const vertexCount = flat.length / 3;
  const cum: number[] = new Array(vertexCount).fill(0);
  for (let i = 1; i < vertexCount; i++) {
    const dx = flat[i * 3]! - flat[(i - 1) * 3]!;
    const dy = flat[i * 3 + 1]! - flat[(i - 1) * 3 + 1]!;
    const dz = flat[i * 3 + 2]! - flat[(i - 1) * 3 + 2]!;
    cum[i] = cum[i - 1]! + Math.hypot(dx, dy, dz);
  }
  const length = vertexCount > 0 ? cum[vertexCount - 1]! : 0;

  function sampleAt(distance: number): Curve3DSample {
    if (vertexCount === 0) return { x: 0, y: 0, z: 0, tangent: { x: 0, y: 0, z: 0 } };
    if (vertexCount === 1) {
      return { x: flat[0]!, y: flat[1]!, z: flat[2]!, tangent: { x: 0, y: 0, z: 0 } };
    }
    const d = Math.max(0, Math.min(length, distance));
    let i = 1;
    while (i < vertexCount && cum[i]! < d) i++;
    const i0 = i - 1;
    const i1 = Math.min(i, vertexCount - 1);
    const segLen = cum[i1]! - cum[i0]!;
    const t = segLen > 0 ? (d - cum[i0]!) / segLen : 0;
    const x0 = flat[i0 * 3]!;
    const y0 = flat[i0 * 3 + 1]!;
    const z0 = flat[i0 * 3 + 2]!;
    const x1 = flat[i1 * 3]!;
    const y1 = flat[i1 * 3 + 1]!;
    const z1 = flat[i1 * 3 + 2]!;
    let tx = x1 - x0;
    let ty = y1 - y0;
    let tz = z1 - z0;
    const len = Math.hypot(tx, ty, tz);
    if (len > 0) {
      tx /= len;
      ty /= len;
      tz /= len;
    }
    return {
      x: x0 + (x1 - x0) * t,
      y: y0 + (y1 - y0) * t,
      z: z0 + (z1 - z0) * t,
      tangent: { x: tx, y: ty, z: tz },
    };
  }

  return { points: flat, length, sampleAt };
}

function appendSpan(
  flat: number[],
  a: Curve3DControlPoint,
  b: Curve3DControlPoint,
  segmentsPerSpan: number
): void {
  const straight =
    a.out.x === 0 && a.out.y === 0 && a.out.z === 0 &&
    b.in.x === 0 && b.in.y === 0 && b.in.z === 0;
  if (straight) {
    flat.push(b.position.x, b.position.y, b.position.z);
    return;
  }
  const p0 = a.position;
  const p1 = { x: a.position.x + a.out.x, y: a.position.y + a.out.y, z: a.position.z + a.out.z };
  const p2 = { x: b.position.x + b.in.x, y: b.position.y + b.in.y, z: b.position.z + b.in.z };
  const p3 = b.position;
  const steps = Math.max(1, segmentsPerSpan);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    flat.push(
      cubic(p0.x, p1.x, p2.x, p3.x, t),
      cubic(p0.y, p1.y, p2.y, p3.y, t),
      cubic(p0.z, p1.z, p2.z, p3.z, t)
    );
  }
}

function cubic(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}
