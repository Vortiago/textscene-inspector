/**
 * Shared value decoders for the lenient parser.
 *
 * Each reads a raw TSCN property string into a typed scalar/vector and
 * follows one contract: fall back silently when the value is ABSENT, but
 * warn-then-fall-back when it is PRESENT yet unparseable (so a malformed
 * scene surfaces in the log while still rendering). The strict linter path
 * validates separately and is unaffected.
 *
 * `intOr` / `floatOr` / `boolOr` / `enumOr` / `vec2Or` take a fallback and
 * always return a value. `parseOptionalInt` is the distinct optional reader:
 * it returns `undefined` for an absent/invalid value (no fallback, no warn),
 * for Control properties where "unset" is meaningful. Pass `context`
 * (a node type or name) to label the warning.
 *
 * Pure `.ts` — importable by `linterParser` slices; never pulls in THREE.
 * These wrap the canonical leaf scanners (`parseVector2` in `parser/vectors.ts`);
 * one-off structured literals (`Vector2i`, `Rect2`, `frame_coords`) stay inline
 * in their node slice, and divergent leaf parsers (the throwing `parseColor`
 * in `standardmaterial3d`, the undefined-returning `parseVector2` in `control`)
 * keep their own contract.
 */

import { warn } from '../logger';
import { parseVector2, type Vector2 } from './vectors';

export function floatOr(value: string | undefined, fallback: number, context = 'value'): number {
  if (value === undefined) return fallback;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) {
    warn(`${context}: invalid float "${value}", using ${fallback}`);
    return fallback;
  }
  return parsed;
}

export function intOr(value: string | undefined, fallback: number, context = 'value'): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    warn(`${context}: invalid int "${value}", using ${fallback}`);
    return fallback;
  }
  return parsed;
}

export function boolOr(value: string | undefined, fallback: boolean, context = 'value'): boolean {
  if (value === undefined) return fallback;
  const v = value.toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  warn(`${context}: invalid bool "${value}", using ${fallback}`);
  return fallback;
}

export function enumOr<T extends number>(
  value: string | undefined,
  fallback: T,
  allowed: readonly T[],
  context = 'value'
): T {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10) as T;
  if (Number.isNaN(parsed) || !allowed.includes(parsed)) {
    warn(`${context}: invalid enum "${value}", using ${fallback}`);
    return fallback;
  }
  return parsed;
}

/**
 * Parse a `Vector2(x, y)` property, falling back when absent and
 * warning-then-falling-back when present but unparseable. Wraps the
 * canonical (throwing) `parseVector2` scanner.
 */
export function vec2Or(value: string | undefined, fallback: Vector2, context = 'value'): Vector2 {
  if (!value) return fallback;
  try {
    return parseVector2(value);
  } catch {
    warn(`${context}: invalid Vector2 "${value}", using fallback`);
    return fallback;
  }
}

/**
 * Optional int reader: returns `undefined` for an absent or unparseable
 * value — no fallback, no warning. Distinct from `intOr`; used where a
 * missing property is itself meaningful (Control layout props). This was
 * `intOr` in `parser/utils.ts` before the value-decoder consolidation;
 * renamed so the two contracts no longer share a name.
 */
export function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
