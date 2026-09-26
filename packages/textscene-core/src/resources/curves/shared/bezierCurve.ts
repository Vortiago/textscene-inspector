/**
 * Curve2D and Curve3D control points from a resource body, as Godot loads them: `_data`
 * through `_set_data`, then `point_count` through `set_point_count`, the order Godot's
 * writer emits them in. The two curves differ only in their {@link BezierCurveReader}.
 * No THREE.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { ruleInt } from '../../../godot/int.js';
import { findSubResourceOfType, parseResourceReference } from '../../SubResourceResolver';
import { readBezierData, type BezierDataFormat } from './bezierData';
import { resizeBezierPoints } from './pointCount';

/** How one Bézier curve class reads its control points. */
export interface BezierCurveReader<P> {
  readonly format: BezierDataFormat;
  /** The `"points"` value text as flat floats. Throws on a value it cannot read. */
  readonly parse: (points: string) => Float32Array;
  /** The control point whose floats start at `base`. */
  readonly pointAt: (flat: Float32Array, base: number) => P;
  /** The point `_add_point` appends: every handle and the position at zero. */
  readonly origin: () => P;
}

/**
 * The control points of a Curve2D or Curve3D body. A `_data` that `_set_data` refuses,
 * or that does not parse, loads no points.
 */
export function decodeBezierCurve<P>(
  data: Readonly<Record<string, unknown>>,
  reader: BezierCurveReader<P>
): P[] {
  const points = readControlPoints(data._data, reader);
  const count = typeof data.point_count === 'string' ? ruleInt(data.point_count) : null;
  return count === null ? points : resizeBezierPoints(points, count, reader.origin);
}

/**
 * The control points of the curve a `SubResource("id")` value names: the first
 * resource of the reader's class under that id, the one the path linters check.
 * No points for any other value, or an id that names no such resource.
 */
export function resolveBezierCurve<P>(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  reader: BezierCurveReader<P>
): P[] {
  const parsed = ref === undefined ? null : parseResourceReference(ref);
  if (parsed?.type !== 'SubResource') return [];
  const resource = findSubResourceOfType(internalResources, parsed.id, reader.format.className);
  return resource ? decodeBezierCurve(resource.data, reader) : [];
}

function readControlPoints<P>(value: unknown, reader: BezierCurveReader<P>): P[] {
  if (typeof value !== 'string') return [];
  const read = readBezierData(value, reader.format);
  if (read.refusal !== null) return [];

  let flat: Float32Array;
  try {
    flat = reader.parse(read.loaded.points);
  } catch {
    return [];
  }

  const points: P[] = [];
  for (let i = 0; i < read.loaded.controlPoints; i++) {
    points.push(reader.pointAt(flat, i * reader.format.floatsPerPoint));
  }
  return points;
}
