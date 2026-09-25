/**
 * Shared value decoders for the lenient parser, pure `.ts` with no THREE. Each falls
 * back silently when a value is absent, and warns and falls back when it is present
 * but unparseable, so a malformed scene still renders. `context` labels the warning.
 */

import { warn } from '../logger';
// These wrap the canonical leaf scanners. One-off structured literals (StyleBox shapes)
// stay in their slice.
import { parseVector2, type Vector2 } from './vectors';
import { slotTupleRegex, parseGodotFloat, allFinite } from '../godot/number.js';
import { slotComponents, storedFromFloat, storedVector2i, type IntWidth } from '../godot/int.js';

import { nodePathLiteral, toIntIndex, boolSlotValue} from '../godot/index.js';

/**
 * A finite scalar in the tokenizer's grammar, or `null`.
 *
 * The renderer's half of the split: a non-finite is legal in the file and
 * undrawable here, so it falls back to the documented default like malformed
 * text does. `v.float` accepts it on the linter side.
 */
function finiteScalar(value: string): number | null {
  const num = parseGodotFloat(value);
  return num !== null && Number.isFinite(num) ? num : null;
}

/**
 * The same, as the integer the slot stores. Narrowed so the previewer and the linter
 * read one number from one literal: `z_index = 4294967295` is the -1 Godot holds.
 */
function finiteIntScalar(value: string, width: IntWidth): number | null {
  const num = finiteScalar(value);
  if (num === null) return null;
  const stored = storedFromFloat(num, value, width);
  return Number.isNaN(stored) ? null : stored;
}


export interface Rect2Value {
  x: number;
  y: number;
  width: number;
  height: number;
}

const RECT2_PATTERN = slotTupleRegex('Rect2', 4);

/**
 * `Rect2(x, y, w, h)` as a rect, or undefined when absent (silently) or malformed
 * (with a warning). Built on the canonical float grammar:
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
  // A `Rect2i` spelling narrows every component to int32 before the widening
  // conversion runs, so the two spellings do not carry the same numbers.
  const c = slotComponents(value, 'Rect2', [m[1], m[2], m[3], m[4]]);
  // `1e999` is inside the finite grammar and outside what a viewport can draw.
  if (!allFinite(c)) {
    warn(`${context}: non-finite Rect2 "${value}"`);
    return undefined;
  }
  return { x: c[0]!, y: c[1]!, width: c[2]!, height: c[3]! };
}

export function floatOr(value: string | undefined, fallback: number, context = 'value'): number {
  if (value === undefined) return fallback;
  // Anchored, so `1.2.3` and `1abc` are refused, not read as 1.2 and 1. A non-finite
  // falls back: the documented renderer/linter split.
  const parsed = finiteScalar(value);
  if (parsed === null) {
    warn(`${context}: invalid float "${value}", using ${fallback}`);
    return fallback;
  }
  return parsed;
}

/**
 * `width` is the setter's argument type, `'int32'` for almost every property.
 * `Camera3D`/`Decal::set_cull_mask` and `AudioStreamPlayer2D/3D::set_area_mask` take
 * `uint32_t`, where signed reads `4294967295` as -1. The validator declares the width
 * again, and `intSlotWidth.guard.test.ts` holds the two to one answer.
 */
export function intOr(
  value: string | undefined,
  fallback: number,
  context = 'value',
  width: IntWidth = 'int32'
): number {
  if (value === undefined) return fallback;
  // The whole token parses, so `hframes = 2e1` is the 20 Godot and the linter read.
  const parsed = finiteIntScalar(value, width);
  if (parsed === null) {
    warn(`${context}: invalid int "${value}", using ${fallback}`);
    return fallback;
  }
  return parsed;
}

export function boolOr(value: string | undefined, fallback: boolean, context = 'value'): boolean {
  if (value === undefined) return fallback;
  // `boolSlotValue` reads the int and float spellings a BOOL slot converts.
  const stored = boolSlotValue(value);
  if (stored !== undefined) return stored;
  warn(`${context}: invalid bool "${value}", using ${fallback}`);
  return fallback;
}

/**
 * A property whose setter refuses a negative argument before assigning
 * (`sphere_shape_3d.cpp:86`, `circle_shape_2d.cpp:46`, both capsules), so it keeps its
 * default. `undefined` for absent, unparseable or negative, warning on the last two:
 * the capsule pair clamps each other only for values the setter accepted.
 */
export function settableNonNegative(
  value: string | undefined,
  context = 'value'
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = finiteScalar(value);
  if (parsed === null) {
    warn(`${context}: invalid float "${value}", keeping the Godot default`);
    return undefined;
  }
  if (parsed < 0) {
    warn(`${context}: Godot refuses the negative value "${value}", keeping the default`);
    return undefined;
  }
  return parsed;
}

/** {@link settableNonNegative} with a concrete default, the common case. */
export function nonNegativeOr(
  value: string | undefined,
  fallback: number,
  context = 'value'
): number {
  return settableNonNegative(value, context) ?? fallback;
}

/**
 * A size whose setter refuses the whole assignment when any component is negative
 * (`box_shape_3d.cpp:100`, `rectangle_shape_2d.cpp:61`), so it keeps its default. Takes
 * a decoded vector: the grammar belongs to `parseVector2` and `parseVector3`.
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
  // An enum constant is an `int` in every BIND_ENUM_CONSTANT.
  const parsed = finiteIntScalar(value, 'int32') as T | null;
  if (parsed === null || !allowed.includes(parsed)) {
    warn(`${context}: invalid enum "${value}", using ${fallback}`);
    return fallback;
  }
  return parsed;
}

/** A `Vector2(x, y)` property through the throwing `parseVector2` scanner. */
export function vec2Or(value: string | undefined, fallback: Vector2, context = 'value'): Vector2 {
  if (!value) return fallback;
  try {
    return parseVector2(value);
  } catch {
    warn(`${context}: invalid Vector2 "${value}", using fallback`);
    return fallback;
  }
}

/** The integer sibling of {@link vec2Or}: {@link parseOptionalVector2i}, or `fallback`. */
export function vec2iOr(value: string | undefined, fallback: Vector2, context = 'value'): Vector2 {
  return parseOptionalVector2i(value, context) ?? fallback;
}

/**
 * The integer sibling of {@link parseOptionalVector2}, but it warns on a malformed
 * value: a malformed `frame_coords` would otherwise pick frame (0,0) with no sign.
 * `storedVector2i` reads it: the slot takes any number token and truncates it
 * (`_parse_construct<int32_t>`), so `SubViewport.size = Vector2i(2e1, 2e1)` is `(20, 20)`.
 */
export function parseOptionalVector2i(
  value: string | undefined,
  context = 'value'
): Vector2 | undefined {
  if (!value) return undefined;
  const stored = storedVector2i(value);
  if (stored === 'malformed') {
    warn(`${context}: invalid Vector2i "${value}"`);
    return undefined;
  }
  if (stored === 'unstorable') {
    warn(`${context}: Vector2i "${value}" has a component Godot cannot store`);
    return undefined;
  }
  return stored;
}

/**
 * `undefined` for an absent or unparseable int, with no warning, where "unset" means
 * something (Control layout props). `width` is as on {@link intOr}: read at int32, a
 * `uint32_t` slot refuses `3e9`, a float literal it holds exactly.
 */
export function parseOptionalInt(
  value: string | undefined,
  width: IntWidth = 'int32'
): number | undefined {
  if (value === undefined) return undefined;
  return finiteIntScalar(value, width) ?? undefined;
}

/**
 * Optional bool reader: `undefined` for an absent value, else what the BOOL
 * slot stores for it. An unconvertible value reads `false`, not `undefined`.
 * Distinct from `boolOr`; used where a missing property is meaningful (Control
 * flags that default off only when present, so absence stays unset).
 */
export function parseOptionalBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return boolSlotValue(value) === true;
}

/** `parseOptionalInt` for floats. */
export function parseOptionalFloat(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  return finiteScalar(value) ?? undefined;
}

/**
 * `undefined` for an absent or unparseable Vector2, with no warning, through
 * `parseVector2` and its `FLOAT_PATTERN_SOURCE`. For Control `custom_minimum_size`.
 * StyleBox `shadow_offset` needs a concrete offset, so it uses `vec2Or`.
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
 * The path a NodePath slot stores: `NodePath("../a")` and the bare `"../a"` it converts
 * (variant.cpp:746-749) both give `"../a"`. `null` for absent or any other spelling, so
 * the caller picks a fallback. The linter's `linterUtils.extractNodePath` also rejects
 * an empty path.
 */
export function parseNodePathLiteral(value: string | undefined): string | null {
  if (value === undefined) return null;
  return nodePathLiteral(value);
}

/**
 * The sibling index a heading's `index=` names. `resource_format_text.cpp:269-270`
 * assigns it to an `int` through `Variant::_to_int` (`variant.h`) and `String::to_int()`:
 * `index="3px"` is 3 and `index=" "` is 0. {@link toIntIndex} is that model. A `NaN`
 * here would poison every sibling-ordering comparison.
 */
export function parseHeadingIndex(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const index = toIntIndex(value);
  // Past `String::to_int`'s own bound this reader cannot name the int64 Godot
  // holds, so it declines rather than letting a wrong number travel.
  return Number.isNaN(index) ? undefined : index;
}
