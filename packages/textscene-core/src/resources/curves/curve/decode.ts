/**
 * Decode a Curve resource body, whichever serialization it arrived in.
 *
 * Godot serialises the whole curve into two internal array properties:
 *
 *   _limits = [min_value, max_value, min_domain, max_domain]
 *   _data   = [Vector2(x, y), left_tangent, right_tangent, left_mode, right_mode, …]
 *
 * `_data` is a flat run of FIVE entries per point, and its first entry is a
 * `Vector2(…)` literal, so it cannot be split on commas the way a
 * `PackedFloat32Array` can. Files written before Godot 4.3 carry a two-element
 * `_limits` (the domain properties did not exist), so both lengths are accepted.
 *
 * The same properties reach us two ways — inline as a `[sub_resource
 * type="Curve"]` block, or as the `[resource]` body of a standalone `.tres`
 * referenced by `ExtResource` — and one decode reads both, so neither arrival
 * path can drift from the other.
 *
 * Pure `.ts`, no THREE.
 */

import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { CurveTangentMode, EMPTY_CURVE, type Curve, type CurvePoint } from './types';
import { slotTupleRegex, matchedFloat, parseGodotFloat } from '../../../godot/number.js';
import { ruleInt } from '../../../godot/int.js';
import { dropTrailingComma, splitTopLevel } from '../../../godot/string.js';

/** Entries per point in `_data`: position, left tangent, right tangent, two modes. */
const ELEMS_PER_POINT = 5;

/**
 * Decode a Curve resource body. A malformed or absent `_data` yields a curve
 * with no points, which `sampleCurve` answers 0 for — callers that need "no
 * curve at all" must test `points.length`, not the sampled value.
 */
export function decodeCurve(data: Record<string, string>): Curve {
  const limits = parseFloatArray(data._limits);
  const curve: Curve = {
    points: parsePoints(data._data),
    minValue: limits?.[0] ?? EMPTY_CURVE.minValue,
    maxValue: limits?.[1] ?? EMPTY_CURVE.maxValue,
    minDomain: limits?.[2] ?? EMPTY_CURVE.minDomain,
    maxDomain: limits?.[3] ?? EMPTY_CURVE.maxDomain,
  };

  // `point_count` is written after `_data`, and Godot's setter resizes the point
  // list to it. Honouring it keeps a hand-edited file from sampling points the
  // resource claims not to have.
  const declared = ruleInt(data.point_count);
  if (declared !== null && declared < curve.points.length) {
    curve.points = curve.points.slice(0, Math.max(0, declared));
  }

  return curve;
}

/**
 * The `Curve` a `SubResource("id")` property names, or null when the reference
 * is absent, is not a SubResource, names nothing, or names something else.
 */
export function resolveCurve(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): Curve | null {
  const resource = resolveSubResourceRef(ref, internalResources);
  if (resource?.type !== 'Curve') return null;
  return decodeCurve(resource.data as Record<string, string>);
}

/**
 * The `Curve` a standalone resource file carries, or null when the file is some
 * other resource type. The `[resource]` body holds exactly the properties an
 * inline `[sub_resource type="Curve"]` block does, so it decodes through the
 * same `decodeCurve`.
 */
export function curveFromResource(parsed: ParsedResource): Curve | null {
  if (parsed.resourceType !== 'Curve') return null;
  return decodeCurve(parsed.properties);
}

function parsePoints(value: string | undefined): CurvePoint[] {
  const entries = splitArrayLiteral(value);
  if (!entries || entries.length === 0 || entries.length % ELEMS_PER_POINT !== 0) return [];

  const points: CurvePoint[] = [];
  for (let i = 0; i < entries.length; i += ELEMS_PER_POINT) {
    const position = parseVector2Entry(entries[i]!);
    if (!position) return [];
    points.push({
      position,
      leftTangent: numberOr(entries[i + 1]!, 0),
      rightTangent: numberOr(entries[i + 2]!, 0),
      leftMode: tangentMode(entries[i + 3]!),
      rightMode: tangentMode(entries[i + 4]!),
    });
  }
  return points;
}

/** `[a, b, c]` of plain floats, or null when the literal is absent/malformed. */
function parseFloatArray(value: string | undefined): number[] | null {
  const entries = splitArrayLiteral(value);
  if (!entries) return null;
  // `parseGodotFloat`, not `parseFloat`: the latter reads `5abc` as 5, and the
  // curve was then scaled by a maximum the file does not contain.
  const numbers = entries.map((e) => parseGodotFloat(e));
  return numbers.some((n) => n === null) ? null : (numbers as number[]);
}

/**
 * Split a Godot `[…]` array literal into its top-level entries, so a nested
 * `Vector2(0, 0)` survives as one entry instead of becoming two. Returns null
 * when the value is absent or is not bracketed.
 *
 * The split itself is `splitTopLevel`: the local copy tracked bracket depth but
 * not quotes, so a quoted entry holding a comma split into two.
 *
 * `dropTrailingComma` because `_parse_array` closes on `TK_BRACKET_CLOSE`
 * before it demands another value (variant_parser.cpp:1658-1662), so `[…, ]`
 * holds one fewer element than the commas suggest. Without it a single legal
 * trailing comma made `_data` fail the `% 5` arity gate and discarded every
 * point in the curve.
 */
function splitArrayLiteral(value: string | undefined): string[] | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  return dropTrailingComma(splitTopLevel(trimmed.slice(1, -1)));
}

/**
 * The canonical finite grammar, not a local `([^,]+?)` pair.
 *
 * The loose components accepted anything up to the next delimiter, so
 * `Vector2(1.2.3, 4)` decoded to `{x: 1.2, y: 4}` and `Vector2(8abc, 4)` to
 * `{x: 8, y: 4}` — a control point the file does not contain, which is the
 * accident `parser/vectors.ts` says the anchored grammar exists to prevent.
 * `Vector2(inf, 0)` was worse than a wrong point: `parsePoints` drops the whole
 * curve on a null, so one non-finite component discarded EVERY point.
 */
const VECTOR2_RE = slotTupleRegex('Vector2', 2);

function parseVector2Entry(entry: string): { x: number; y: number } | null {
  const match = VECTOR2_RE.exec(entry);
  if (!match) return null;
  return { x: matchedFloat(match[1]!), y: matchedFloat(match[2]!) };
}

function numberOr(entry: string, fallback: number): number {
  return parseGodotFloat(entry) ?? fallback;
}

function tangentMode(entry: string): CurveTangentMode {
  return ruleInt(entry) === CurveTangentMode.Linear ? CurveTangentMode.Linear : CurveTangentMode.Free;
}
