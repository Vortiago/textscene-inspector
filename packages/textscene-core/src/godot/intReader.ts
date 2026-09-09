/**
 * Reading an integer literal the way the engine stores it for a slot width.
 * See `int.ts` for the whole picture.
 */

import { parseGodotFloat } from './number.js';
import { REPRESENTABLE, ROUND_TRIPS, toInt32, toUint32, toUint8 } from './intWidth.js';
import type { IntWidth } from './intWidth.js';

/** `T(int64)`, the integral conversion — defined for every input, in both directions. */
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
 * ELEMENT, and a literal here allocates a RegExp on every one of them.
 */
const FLOAT_TYPED = /[.eE]/;

/**
 * A number as the integer an INT slot STORES: truncated toward zero, which is
 * what `T(_data._float)` does.
 *
 * A NON-FINITE number is not representable at all, and reads as NaN rather than
 * passing through. Measured on 4.6.3 stable (x86_64), `Vector2i(inf, 8)`,
 * `(-inf, 8)`, `(inf_neg, 8)` and `(nan, 8)` all store `(-2147483648, 8)` — the
 * narrowing happens at PARSE time, so the stored value is not what the file
 * says. That number is deliberately NOT returned here: the conversion is
 * undefined behaviour in C++ and the practical result is architecture-specific
 * (x86 `cvttsd2si` yields INT32_MIN, AArch64 `fcvtzs` saturates the other way),
 * and Godot ships on both. NaN keeps every bound comparison false, so no
 * message can print a number no platform agrees on; the ALTERATION itself is
 * what a diagnostic reports, which is the portable claim.
 *
 * Width is NOT applied here. This is the int64 the Variant holds; a slot
 * narrower than that applies {@link toInt32} or {@link toUint32} itself,
 * because the two disagree on the same bits and only the slot knows which.
 */
function asStoredInt(num: number): number {
  return Number.isFinite(num) ? Math.trunc(num) : NaN;
}

/**
 * A TSCN literal as the integer a Godot property slot STORES — three outcomes:
 * `null` when the tokenizer cannot read the text, `NaN` when it reads but the
 * conversion into this slot is undefined, and otherwise the number the engine
 * holds.
 *
 * Not `parseInt`. Two distinct accidents come from `parseInt` stopping at the
 * first character it cannot use, and both cleared bounds silently:
 *
 * - `2e4` read as 2. The tokenizer sets `is_float` on the `e`, and the FLOAT is
 *   converted on assignment, so Godot stores 20000 and any ceiling below it
 *   should have reported.
 * - `8abc` read as 8. Godot's parser cannot read that at all, so it is a format
 *   error rather than a value in range.
 *
 * A float literal in an INT slot is legal and truncates TOWARD ZERO, so `5.9`
 * is 5 and `-5.9` is -5.
 *
 * NARROWED, because almost every Godot property setter takes `int`. Skipping
 * that step reads a value the engine never holds: `limit_left = 4294967295` is
 * -1 to the engine, and a rule comparing 4294967295 described a scroll window
 * that does not exist. Godot's own serialiser writes the wide spelling —
 * measured on 4.6.3, `Node2D.visibility_layer = -1` is written back as
 * `4294967295` — so narrowing is reading the file the way it was written, not
 * second-guessing it.
 *
 * The two literal types behave differently, because `_to_int` converts them on
 * different branches. Measured on 4.6.3 (x86_64), `Node2D.light_mask`:
 *
 * ```
 * 3000000000    (INT)    -> -1294967296   int64 -> int32, wraps
 * 3e9           (FLOAT)  -> -2147483648   double -> int32, UB
 * 4294967295    (INT)    -> -1
 * 4.294967295e9 (FLOAT)  -> -2147483648   UB again
 * ```
 *
 * An INT literal ALWAYS converts: `T(int64)` is an integral conversion, so it
 * wraps in both directions, and `String::to_int` saturates at INT64_MAX rather
 * than refusing (`ustring.cpp:2650-2658`). The one thing that stops us is a
 * reader limit rather than an engine one — a JS double past 2^53 is no longer
 * the int64 the file states, so its low 32 bits are not ours to name.
 *
 * A FLOAT literal converts only inside the SLOT's own band; outside it the C++
 * conversion is undefined. That band is the reason `width` exists: reading
 * every slot as int32 refused `seed = 4294967295.0` at the very ceiling its
 * `PROPERTY_HINT_RANGE` declares, while accepting `-1.0` there, which is the
 * genuinely undefined one.
 */
export function parseGodotInt(
  value: string,
  width: IntWidth = 'int32',
  /** See {@link storedFromFloat}. */
  alwaysFloatBranch = false
): number | null {
  // No grammar pre-test: `parseGodotFloat` returns non-null only for a
  // non-finite spelling — every one of which matches TSCN_FLOAT_RE, since the
  // pattern is built from those keys — or for text that passed TSCN_FLOAT_RE
  // itself. Nothing can fail a pre-test here and still survive the call, and
  // this runs once per ELEMENT of a packed array (a stage's GridMap carries
  // ~8,800), so the duplicate test and trim were the measurable half of it.
  // `parseGodotFloat` trims; `FLOAT_TYPED` looks for `.`/`e`, neither of which
  // is whitespace, so the raw text answers it just as well.
  const asFloat = parseGodotFloat(value);
  return asFloat === null ? null : storedFromFloat(asFloat, value, width, alwaysFloatBranch);
}

/**
 * The integer a slot stores, from a float the caller has ALREADY read.
 *
 * The combinators that must first decide whether a literal is whole-valued
 * hold the parsed float already; re-reading the raw text for the narrowing
 * doubled the cost of every `v.strictInt` call.
 *
 * `literal` decides which `_to_int` branch the engine takes, and the two answer
 * differently only outside the width's band — so the common in-band element
 * never runs the test.
 */
export function storedFromFloat(
  asFloat: number,
  literal: string,
  width: IntWidth = 'int32',
  /**
   * Force the double branch whatever the token looks like.
   *
   * For a component of a FLOAT-typed composite being converted into an
   * `i`-suffixed slot: `Vector2` holds two doubles, so `Vector2(4294967295, 64)`
   * written to a `Vector2i` property converts BOTH components through
   * `double -> int32`, however the token was spelled. Measured on 4.6.3 —
   * `ItemList.fixed_icon_size = Vector2(4294967295, 64)` stores
   * `(-2147483648, 64)`, the UB sentinel, where the `Vector2i(...)` spelling of
   * the same digits stores `(-1, 64)` by wrapping.
   */
  alwaysFloatBranch = false
): number {
  const stored = asStoredInt(asFloat);
  if (Number.isNaN(stored)) return NaN;
  // A FLOAT literal reaches only what the type represents; an INT one also
  // reaches the opposite spelling of the same bits, which is a form Godot's own
  // serialiser writes.
  const floatBranch = alwaysFloatBranch || FLOAT_TYPED.test(literal);
  const [low, high] = floatBranch ? REPRESENTABLE[width] : ROUND_TRIPS[width];
  if (stored < low || stored > high || !Number.isSafeInteger(stored)) return NaN;
  return wrapToWidth(stored, width);
}
