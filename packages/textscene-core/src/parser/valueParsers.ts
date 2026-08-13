/**
 * Shared value decoders for the lenient parser.
 *
 * Each reads a raw TSCN property string into a typed scalar/vector and
 * follows one contract: fall back silently when the value is ABSENT, but
 * warn-then-fall-back when it is PRESENT yet unparseable (so a malformed
 * scene surfaces in the log while still rendering). The strict linter path
 * validates separately and is unaffected.
 *
 * `settableNonNegative` / `nonNegativeOr` / `nonNegativeSizeOr` add the guard
 * Godot's own setters apply: a negative argument is REFUSED (`ERR_FAIL_COND_MSG`
 * returns before assigning), so the property keeps its default rather than
 * storing a value Godot never holds. The `settable` variant reports `undefined`
 * for refused-or-absent, for callers that must know whether a property was set.
 *
 * `intOr` / `floatOr` / `boolOr` / `enumOr` / `vec2Or` take a fallback and
 * always return a value. The `parseOptional*` family (`parseOptionalInt` /
 * `parseOptionalFloat` / `parseOptionalBool` / `parseOptionalVector2`) are the
 * distinct optional readers, for properties where "unset" is meaningful (Control
 * layout props, optional light scalars): no fallback and no warning. All four
 * return `undefined` when the property is ABSENT; on a present-but-unparseable
 * value the numeric and vector readers also return `undefined`, but
 * `parseOptionalBool` returns `false` — it is `value === 'true'`, so anything
 * else reads as false rather than unset. Pass `context` (a node type or name) to
 * label the warning.
 *
 * Pure `.ts` — importable by `linterParser` slices; never pulls in THREE.
 * These wrap the canonical leaf scanners (`parseVector2` in `parser/vectors.ts`);
 * genuinely one-off structured literals (StyleBox shapes) stay inline in
 * their node slice, and the throwing `parseColor` in `standardmaterial3d` keeps
 * its own contract. `Rect2` graduated the same way `Vector2i` did: a second
 * slice's hand-rolled grammar accepted `1.2.3` and stored a NaN region — an
 * invisible frame — so the canonical-grammar reader lives here now. `Vector2i`
 * was such a one-off until a third slice needed it (`SubViewport.size` /
 * `size_2d_override`, after `Sprite2D`/`Sprite3D` `frame_coords`), and it keeps
 * its own pair here because the components are TRUNCATED, not because the
 * grammar differs — Godot reads an INT slot with any number token and converts.
 */

import { warn } from '../logger';
import { finiteTupleRegex, parseVector2, storedInt, type Vector2 } from './vectors';
import { nodePathLiteral } from '../godot/index.js';

export interface Rect2Value {
  x: number;
  y: number;
  width: number;
  height: number;
}

const RECT2_PATTERN = finiteTupleRegex('Rect2', 4);

/**
 * `Rect2(x, y, w, h)` → a rect; undefined when absent (silently) or present
 * but malformed (warn-then-unset). Built on the canonical float grammar:
 * each component must parse whole, so `1.2.3` and `--1` are refused outright
 * instead of truncating or landing as NaN.
 */
export function parseOptionalRect2(
  value: string | undefined,
  context = 'value'
): Rect2Value | undefined {
  if (value === undefined) return undefined;
  const m = RECT2_PATTERN.exec(value);
  if (!m) {
    warn(`${context}: invalid Rect2 "${value}", treating as unset`);
    return undefined;
  }
  return {
    x: parseFloat(m[1]!),
    y: parseFloat(m[2]!),
    width: parseFloat(m[3]!),
    height: parseFloat(m[4]!),
  };
}

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

/**
 * Reader for a property whose Godot setter REFUSES a negative argument
 * (`ERR_FAIL_COND_MSG`, e.g. `sphere_shape_3d.cpp:86`, `circle_shape_2d.cpp:46`,
 * both capsule shapes): the setter returns before assigning, so the property
 * keeps the value it held — at load time, its default.
 *
 * Returns `undefined` for an absent, unparseable OR negative value, so a caller
 * that must know whether the property was SET can tell — the linked capsule
 * radius/height pair clamps each other only for values the setter accepted.
 * Silent when absent, warns for the two authored-but-refused cases.
 */
export function settableNonNegative(
  value: string | undefined,
  context = 'value'
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) {
    warn(`${context}: invalid float "${value}", keeping the Godot default`);
    return undefined;
  }
  if (parsed < 0) {
    warn(`${context}: Godot refuses the negative value "${value}", keeping the default`);
    return undefined;
  }
  return parsed;
}

/** {@link settableNonNegative} with a concrete default — the common case. */
export function nonNegativeOr(
  value: string | undefined,
  fallback: number,
  context = 'value'
): number {
  return settableNonNegative(value, context) ?? fallback;
}

/**
 * A size whose Godot setter ERR_FAILs when ANY component is negative
 * (`box_shape_3d.cpp:100`, `rectangle_shape_2d.cpp:61`). The whole assignment is
 * refused, not clamped per component, so the property keeps its default; a
 * per-component clamp would invent a size Godot never stores.
 *
 * Takes an already-decoded vector: the grammar belongs to `parseVector2` /
 * `parseVector3`, this only applies the setter's guard.
 */
export function nonNegativeSizeOr<T extends { x: number; y: number; z?: number }>(
  size: T,
  fallback: T,
  context = 'value'
): T {
  if (size.x < 0 || size.y < 0 || (size.z ?? 0) < 0) {
    warn(`${context}: Godot refuses a size with a negative component, using the default`);
    return fallback;
  }
  return size;
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
 * The one `Vector2i(x, y)` grammar. Godot writes Vector2i wherever a value is a
 * pixel count (`SubViewport.size`, `Sprite2D.frame_coords`).
 *
 * The same component grammar as the float composites, not `-?\d+`: Godot reads
 * an INT slot with `_parse_construct<int32_t>`, which takes any number token
 * and converts it. `SubViewport.size = Vector2i(2e1, 2e1)` is a file Godot
 * loads as `(20, 20)`, and the narrower grammar warned-and-fell-back to the
 * default instead — a viewport drawn at the wrong size on a valid scene.
 */
const VECTOR2I_PATTERN = finiteTupleRegex('Vector2i', 2);

/**
 * Parse a `Vector2i(x, y)` property, falling back when absent and
 * warning-then-falling-back when present but unparseable — the integer sibling
 * of {@link vec2Or}.
 */
export function vec2iOr(value: string | undefined, fallback: Vector2, context = 'value'): Vector2 {
  if (!value) return fallback;
  const match = VECTOR2I_PATTERN.exec(value);
  if (!match) {
    warn(`${context}: invalid Vector2i "${value}", using fallback`);
    return fallback;
  }
  return { x: storedInt(match[1]), y: storedInt(match[2]) };
}

/**
 * Optional `Vector2i` reader: `undefined` for an absent value, and
 * warn-then-`undefined` for a present-but-malformed one — the integer sibling of
 * {@link parseOptionalVector2}, kept warning because a malformed
 * `frame_coords` silently picks sprite frame (0,0) otherwise.
 */
export function parseOptionalVector2i(
  value: string | undefined,
  context = 'value'
): Vector2 | undefined {
  if (!value) return undefined;
  const match = VECTOR2I_PATTERN.exec(value);
  if (!match) {
    warn(`${context}: invalid Vector2i "${value}"`);
    return undefined;
  }
  return { x: storedInt(match[1]), y: storedInt(match[2]) };
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

/**
 * Optional bool reader: `undefined` for an absent value, else `value === 'true'`.
 * Distinct from `boolOr`; used where a missing property is meaningful (Control
 * flags that default off only when present, so absence stays unset).
 */
export function parseOptionalBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === 'true';
}

/**
 * Optional float reader: returns `undefined` for an absent or unparseable
 * value — no fallback, no warning. Mirrors `parseOptionalInt` for floats;
 * used where a missing numeric property is itself meaningful.
 */
export function parseOptionalFloat(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Optional Vector2 reader: returns `undefined` for an absent or unparseable
 * value — no fallback, no warning. Wraps the canonical (throwing) `parseVector2`
 * so its float grammar (`FLOAT_PATTERN_SOURCE`) is shared. Used for Control
 * `custom_minimum_size` (StyleBox `shadow_offset` uses the `{0,0}`-fallback
 * `vec2Or` instead, since its render always needs a concrete offset).
 */
export function parseOptionalVector2(value: string | undefined): Vector2 | undefined {
  if (!value) return undefined;
  try {
    return parseVector2(value);
  } catch {
    return undefined;
  }
}

/**
 * Extract the inner path of a `NodePath("...")` literal — `NodePath("../a")`
 * → `"../a"` (an empty literal yields `""`). Returns `null` for an absent
 * value or anything that is not a NodePath literal, so callers choose their
 * own fallback (`?? raw`, `?? '(none)'`). The canonical NodePath decoder for
 * display formatters; the linter keeps its stricter variant
 * (`linterUtils.extractNodePath`) which also rejects empty paths.
 */
export function parseNodePathLiteral(value: string | undefined): string | null {
  if (value === undefined) return null;
  return nodePathLiteral(value);
}
