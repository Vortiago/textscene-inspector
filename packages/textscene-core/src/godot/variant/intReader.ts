/**
 * Reading an integer literal the way the engine stores it for a slot width.
 * See `int.ts` for the whole picture.
 */

import { parseGodotFloat } from './number.js';
import { REPRESENTABLE, ROUND_TRIPS, toInt32, toUint32, toUint8 } from './intWidth.js';
import type { IntWidth } from './intWidth.js';

/** `T(int64)`, the integral conversion, defined for every input in both directions. */
function wrapToWidth(value: number, width: IntWidth): number {
  if (width === 'int32') return toInt32(value);
  if (width === 'uint32') return toUint32(value);
  // Total over the union rather than falling through to int64: a width whose
  // arm is missing is silently un-narrowed, and adding the union member is what
  // compiles green while doing nothing.
  if (width === 'uint8') return toUint8(value);
  return value;
}

/**
 * The tokenizer types a literal FLOAT on a `.` or an exponent
 * (`variant_parser.cpp:442`, `:446-448`), and that choice decides which
 * `_to_int` branch runs. Module level: this is tested once per packed-array
 * element, and a literal in the function would allocate a RegExp for each.
 */
const FLOAT_TYPED = /[.eE]/;

/**
 * A number as the integer an INT slot stores: truncated toward zero, as `T(_data._float)` does.
 * Non-finite reads as NaN: 4.6.3 on x86_64 stores `Vector2i(inf, 8)` (or `-inf`, `inf_neg`, `nan`) as
 * `(-2147483648, 8)` at parse time, but the conversion is undefined and AArch64 saturates the other
 * way, so a diagnostic reports the alteration. No width: {@link toInt32} and {@link toUint32} differ.
 */
function asStoredInt(num: number): number {
  return Number.isFinite(num) ? Math.trunc(num) : NaN;
}

/**
 * A TSCN literal as the integer a Godot property slot stores: `null` when the tokenizer cannot read
 * it, `NaN` when the conversion into this slot is undefined, else the number the engine holds. Not
 * `parseInt`, which reads `2e4` as 2 (Godot stores 20000) and `8abc` as 8 (a format error). A float
 * truncates toward zero (`-5.9` is -5), and the result is narrowed, as setters take `int`.
 */
export function parseGodotInt(
  value: string,
  width: IntWidth = 'int32',
  /** See {@link storedFromFloat}. */
  alwaysFloatBranch = false
): number | null {
  // No grammar pre-test or trim: `parseGodotFloat` applies TSCN_FLOAT_RE and trims, and this runs
  // once per packed-array element. `FLOAT_TYPED` looks for `.` or `e`, never whitespace, so the raw
  // text answers it.
  const asFloat = parseGodotFloat(value);
  return asFloat === null ? null : storedFromFloat(asFloat, value, width, alwaysFloatBranch);
}

/**
 * The integer a slot stores, from a float the caller has already read, so a combinator such as
 * `v.strictInt` reads the text once. `literal` picks the `_to_int` branch.
 */
export function storedFromFloat(
  asFloat: number,
  literal: string,
  width: IntWidth = 'int32',
  /**
   * Force the double branch: a `Vector2` holds doubles, so `Vector2(4294967295, 64)` in a `Vector2i`
   * slot converts through `double -> int32`. Measured on 4.6.3: `ItemList.fixed_icon_size` stores
   * `(-2147483648, 64)` for it, where `Vector2i(4294967295, 64)` wraps to `(-1, 64)`.
   */
  alwaysFloatBranch = false
): number {
  const stored = asStoredInt(asFloat);
  if (Number.isNaN(stored)) return NaN;
  // A FLOAT literal reaches only the type's range, as the C++ conversion is undefined outside it
  // (`seed = 4294967295.0` fits uint32, `-1.0` does not). An INT literal wraps, and `String::to_int`
  // saturates (`ustring.cpp:2650-2658`), so it also reaches the opposite spelling Godot writes. On
  // 4.6.3, `light_mask = 3000000000` wraps to -1294967296, and `3e9` stores -2147483648.
  const floatBranch = alwaysFloatBranch || FLOAT_TYPED.test(literal);
  const [low, high] = floatBranch ? REPRESENTABLE[width] : ROUND_TRIPS[width];
  // Past 2^53 a double is no longer the int64 the file states: a reader limit, not the engine's.
  if (stored < low || stored > high || !Number.isSafeInteger(stored)) return NaN;
  return wrapToWidth(stored, width);
}
