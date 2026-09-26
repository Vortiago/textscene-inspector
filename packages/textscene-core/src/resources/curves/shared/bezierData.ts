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
  readonly className: string;
  /** Where `_set_data` refuses, for a diagnostic's citation. */
  readonly refusedAt: string;
  /** Floats per control point: the in handle, the out handle and the position. */
  readonly floatsPerPoint: number;
  /** `"points"` in `_data`, with its value text in `[1]`. */
  readonly pointsField: RegExp;
  readonly pointsForms: readonly RegExp[];
  readonly vectorSize: number;
  /** The keys besides `"points"` that `_set_data` refuses the dictionary without. */
  readonly otherRequiredKeys: readonly { readonly key: string; readonly present: RegExp }[];
}

function bezierDataFormat(
  className: string,
  refusedAt: string,
  vectorSize: number,
  otherRequiredKeys: readonly string[]
): BezierDataFormat {
  const pointsType = `PackedVector${vectorSize}Array`;
  return {
    className,
    refusedAt,
    floatsPerPoint: vectorSize * 3,
    pointsField: dictPackedField('points', pointsType),
    pointsForms: packedArrayForms(pointsType),
    vectorSize,
    otherRequiredKeys: otherRequiredKeys.map((key) => ({
      key,
      present: new RegExp(`"${key}"\\s*:`),
    })),
  };
}

/** `Curve2D::_set_data` (curve.cpp:1238-1259). */
export const CURVE2D_DATA = bezierDataFormat('Curve2D', 'curve.cpp:1239-1243', 2, []);

/** `Curve3D::_set_data` (curve.cpp:2278-2299) also requires `"tilts"` (curve.cpp:2280). */
export const CURVE3D_DATA = bezierDataFormat('Curve3D', 'curve.cpp:2279-2284', 3, ['tilts']);

/** Why `_set_data` refuses a `_data` value, which leaves the curve with no points. */
export type BezierDataRefusal =
  | { readonly kind: 'missing-key'; readonly key: string }
  | { readonly kind: 'partial-point'; readonly floats: number };

/** A `_data` value `_set_data` loads: its `"points"` value text and how many control points it holds. */
export interface BezierDataPoints {
  readonly points: string;
  readonly controlPoints: number;
}

/**
 * Read `data` as `_set_data` does. It fails on a missing key, then on `pc % 3 != 0`,
 * where `pc` counts vectors (curve.cpp:1239-1243, 2279-2284). Either way it returns
 * before it touches the point list.
 */
export function readBezierData(
  data: string,
  format: BezierDataFormat
): { readonly refusal: BezierDataRefusal } | { readonly refusal: null; readonly loaded: BezierDataPoints } {
  const points = format.pointsField.exec(data)?.[1];
  if (points === undefined) return { refusal: { kind: 'missing-key', key: 'points' } };
  const missing = format.otherRequiredKeys.find(({ present }) => !present.test(data));
  if (missing !== undefined) return { refusal: { kind: 'missing-key', key: missing.key } };

  const floats = packedFloatCount(format.pointsForms, points, format.vectorSize);
  if (floats % format.floatsPerPoint !== 0) return { refusal: { kind: 'partial-point', floats } };
  return { refusal: null, loaded: { points, controlPoints: floats / format.floatsPerPoint } };
}

/** The sentence a diagnostic gives for `refusal`, naming its consequence. */
export function bezierRefusalProblem(refusal: BezierDataRefusal, format: BezierDataFormat): string {
  const { className, refusedAt, floatsPerPoint } = format;
  if (refusal.kind === 'missing-key') {
    return (
      `its ${className} has no "${refusal.key}" in \`_data\`. Godot requires it (${refusedAt}) ` +
      'and loads the curve with zero points, so the path draws nothing.'
    );
  }
  return (
    `its ${className} "points" holds ${refusal.floats} floats. Godot needs a whole number of ` +
    `control points at ${floatsPerPoint} floats each (in / out / position) and loads the curve ` +
    'with zero points otherwise.'
  );
}
