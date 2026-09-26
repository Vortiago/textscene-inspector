/**
 * What `Curve2D::_set_data` and `Curve3D::_set_data` accept in `_data`: the keys they
 * require and the point layout they refuse otherwise. The decoders and the path
 * linters share it, so a curve the linter calls unloadable is one the preview leaves
 * empty. No THREE.
 */

import { packedArrayForms } from '../../../godot/index.js';
import { dictPackedField, packedFloatCount } from '../../../godot/packedArrayFields.js';

/** The `_data` layout of one Bézier curve class. */
export interface BezierDataFormat {
  /** `"points"` in `_data`, with its value text in `[1]`. */
  readonly pointsField: RegExp;
  readonly pointsForms: readonly RegExp[];
  /** Components in one vector of `"points"`: 2 or 3. */
  readonly vectorSize: number;
  /** Floats per control point: the in handle, the out handle and the position. */
  readonly floatsPerPoint: number;
  /** The keys besides `"points"` that `_set_data` refuses the dictionary without. */
  readonly otherRequiredKeys: readonly string[];
}

function bezierDataFormat(
  pointsType: string,
  vectorSize: number,
  otherRequiredKeys: readonly string[]
): BezierDataFormat {
  return {
    pointsField: dictPackedField('points', pointsType),
    pointsForms: packedArrayForms(pointsType),
    vectorSize,
    floatsPerPoint: vectorSize * 3,
    otherRequiredKeys,
  };
}

/** `Curve2D::_set_data` (curve.cpp:1238-1259). */
export const CURVE2D_DATA = bezierDataFormat('PackedVector2Array', 2, []);

/** `Curve3D::_set_data` (curve.cpp:2278-2299) also requires `"tilts"` (curve.cpp:2280). */
export const CURVE3D_DATA = bezierDataFormat('PackedVector3Array', 3, ['tilts']);

/** Why `_set_data` refuses a `_data` value, which leaves the curve with no points. */
export type BezierDataRefusal =
  | { readonly kind: 'missing-key'; readonly key: string }
  | { readonly kind: 'partial-point'; readonly floats: number };

/** The `"points"` value text, or null when `_data` holds none this reader can read. */
export function bezierPointsLiteral(data: string, format: BezierDataFormat): string | null {
  return format.pointsField.exec(data)?.[1] ?? null;
}

/**
 * The reason `_set_data` refuses `data`, or null when it loads. It fails on a missing
 * key, then on `pc % 3 != 0`, where `pc` counts vectors (curve.cpp:1239-1243,
 * 2279-2284). Either way it returns before it touches the point list.
 */
export function bezierDataRefusal(
  data: string,
  format: BezierDataFormat
): BezierDataRefusal | null {
  const points = bezierPointsLiteral(data, format);
  if (points === null) return { kind: 'missing-key', key: 'points' };
  const missing = format.otherRequiredKeys.find((key) => !hasKey(data, key));
  if (missing !== undefined) return { kind: 'missing-key', key: missing };

  const floats = packedFloatCount(format.pointsForms, points, format.vectorSize);
  return floats % format.floatsPerPoint === 0 ? null : { kind: 'partial-point', floats };
}

function hasKey(data: string, key: string): boolean {
  return new RegExp(`"${key}"\\s*:`).test(data);
}
