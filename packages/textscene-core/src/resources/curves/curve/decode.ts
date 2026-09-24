/**
 * Decode a Curve resource body, inline `[sub_resource]` or standalone `.tres`, through
 * one decode so neither arrival path drifts. Godot writes `_limits = [min_value,
 * max_value, min_domain, max_domain]` (two entries before Godot 4.3) and `_data`.
 */

import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { CurveTangentMode, EMPTY_CURVE, type Curve, type CurvePoint } from './types';
import { slotTupleRegex, parseGodotFloat, allFinite } from '../../../godot/number.js';
import { ruleInt, slotComponents } from '../../../godot/int.js';
import { dropTrailingComma, splitTopLevel } from '../../../godot/string.js';
import { resizePoints } from './pointCount';

/**
 * Entries per point in `_data`: `Vector2(x, y)`, left tangent, right tangent, left
 * mode, right mode. The `Vector2(…)` entry means `_data` cannot split on commas.
 */
const ELEMS_PER_POINT = 5;

/**
 * Decode a Curve resource body. A malformed or absent `_data` yields a curve with
 * no points, which `sampleCurve` answers 0 for: a caller that needs "no curve at
 * all" tests `points.length`, not the sampled value.
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
  // list to it (curve.cpp:41-57): a smaller count drops the tail, a larger one
  // pads with default points, and a negative one is refused, leaving `_data` alone.
  const declared = ruleInt(data.point_count);
  if (declared !== null && declared >= 0) curve.points = resizePoints(curve, declared);

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

/** The `Curve` a standalone resource file carries, or null for another resource type. */
export function curveFromResource(parsed: ParsedResource): Curve | null {
  if (parsed.resourceType !== 'Curve') return null;
  return decodeCurve(parsed.properties);
}

function parsePoints(value: string | undefined): CurvePoint[] {
  const entries = splitArrayLiteral(value);
  if (!entries || entries.length === 0 || entries.length % ELEMS_PER_POINT !== 0) return [];

  const points: CurvePoint[] = [];
  for (let i = 0; i < entries.length; i += ELEMS_PER_POINT) {
    // One unreadable point drops the whole curve, as in the engine: `set_data`
    // validates every element before the first write to `_points` (`curve.cpp:465`,
    // write at `:477`). `point_count` then pads it back to clamped-origin defaults.
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
  // `parseGodotFloat`, not `parseFloat`, which reads `5abc` as 5. Finite, since a
  // non-finite limit clamps every padded point onto Infinity and scales every sample by it.
  const numbers = entries.map((e) => parseGodotFloat(e));
  return numbers.some((n) => n === null || !Number.isFinite(n)) ? null : (numbers as number[]);
}

/**
 * Split a Godot `[…]` array literal into its top-level entries, so a nested
 * `Vector2(0, 0)` stays one entry. Null when the value is absent or not bracketed.
 */
function splitArrayLiteral(value: string | undefined): string[] | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  // `_parse_array` closes on `TK_BRACKET_CLOSE` before it demands another value
  // (variant_parser.cpp:1658-1662), so `[…, ]` holds one fewer element than the
  // commas suggest. A kept trailing comma would fail the `% 5` arity gate.
  return dropTrailingComma(splitTopLevel(trimmed.slice(1, -1)));
}

/**
 * The canonical finite grammar, not a loose `([^,]+?)` pair, which reads
 * `Vector2(8abc, 4)` as `{x: 8, y: 4}`: a control point the file does not contain.
 */
const VECTOR2_RE = slotTupleRegex('Vector2', 2);

/**
 * The position of one `_data` entry, or null when it is not a finite `Vector2`.
 * The result is tested, not only the grammar: `Vector2(0, 1e999)` matches the
 * finite pattern and reads as `Infinity`, which would reach the particle geometry.
 */
function parseVector2Entry(entry: string): { x: number; y: number } | null {
  const match = VECTOR2_RE.exec(entry);
  if (!match) return null;
  // `slotComponents`, not bare `matchedFloat`: the slot grammar admits the
  // `Vector2i` spelling, whose arguments Godot narrows to int32 before widening
  // into the float slot, so `Vector2i(4294967295, 0)` is the point `(-1, 0)`.
  const components = slotComponents(entry, 'Vector2', [match[1], match[2]]);
  if (!allFinite(components)) return null;
  return { x: components[0]!, y: components[1]! };
}

/**
 * One tangent slot, or `fallback` when the text is not a finite float. `inf` and
 * `nan` are a miss, not a value: `sample`'s `y + d * tangent` would hand either on
 * to the particle geometry.
 */
function numberOr(entry: string, fallback: number): number {
  const num = parseGodotFloat(entry);
  return num !== null && Number.isFinite(num) ? num : fallback;
}

function tangentMode(entry: string): CurveTangentMode {
  return ruleInt(entry) === CurveTangentMode.Linear ? CurveTangentMode.Linear : CurveTangentMode.Free;
}
