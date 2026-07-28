/**
 * Decode a `[sub_resource type="Curve"]` block.
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
 * Pure `.ts`, no THREE.
 */

import type { TscnInternalResource } from '../../parser/types';
import { findSubResource, parseResourceReference } from '../SubResourceResolver';
import { CurveTangentMode, EMPTY_CURVE, type Curve, type CurvePoint } from './types';

/** Entries per point in `_data`: position, left tangent, right tangent, two modes. */
const ELEMS_PER_POINT = 5;

/**
 * Decode a Curve resource body. A malformed or absent `_data` yields a curve
 * with no points, which `sampleCurve` answers 0 for — callers that need "no
 * curve at all" must test `points.length`, not the sampled value.
 */
export function parseCurve(data: Record<string, string>): Curve {
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
  const declared = data.point_count === undefined ? null : parseInt(data.point_count, 10);
  if (declared !== null && Number.isFinite(declared) && declared < curve.points.length) {
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
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return null;

  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'Curve') return null;

  return parseCurve(resource.data as Record<string, string>);
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
  const numbers = entries.map((e) => parseFloat(e));
  return numbers.some((n) => Number.isNaN(n)) ? null : numbers;
}

/**
 * Split a Godot `[…]` array literal into its top-level entries, so a nested
 * `Vector2(0, 0)` survives as one entry instead of becoming two. Returns null
 * when the value is absent or is not bracketed.
 */
function splitArrayLiteral(value: string | undefined): string[] | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;

  const body = trimmed.slice(1, -1).trim();
  if (body === '') return [];

  const entries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      entries.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  entries.push(body.slice(start).trim());
  return entries;
}

const VECTOR2_RE = /^Vector2\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)$/;

function parseVector2Entry(entry: string): { x: number; y: number } | null {
  const match = VECTOR2_RE.exec(entry);
  if (!match) return null;
  const x = parseFloat(match[1]!);
  const y = parseFloat(match[2]!);
  return Number.isNaN(x) || Number.isNaN(y) ? null : { x, y };
}

function numberOr(entry: string, fallback: number): number {
  const parsed = parseFloat(entry);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function tangentMode(entry: string): CurveTangentMode {
  return parseInt(entry, 10) === CurveTangentMode.Linear
    ? CurveTangentMode.Linear
    : CurveTangentMode.Free;
}
