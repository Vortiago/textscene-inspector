/**
 * Variant to fixed-width integer, as the engine converts on a property write.
 *
 * `_to_int<T>` (`variant.h:360-377`) switches on the Variant's type, and the two
 * branches behave differently enough that callers must pick one deliberately:
 *
 * - `case INT: return T(_data._int)` (`:367-368`) — int64 to T. PORTABLE: a
 *   value inside uint32 wraps the same way on every platform Godot ships, so
 *   the stored number can be named in a diagnostic.
 * - `case FLOAT: return T(_data._float)` (`:369-370`) — double to T. Undefined
 *   behaviour for a non-finite or out-of-range double, and architecture-
 *   specific in practice, so the stored number must NOT be named. See
 *   {@link asStoredInt}.
 *
 * Which width applies is a per-SLOT fact — the setter's argument type or a
 * container's element type — never a parse fact. Godot serialises a negative
 * enum in its unsigned form (`clip_children = -1` is written `4294967295`), so
 * a reader that skips the narrowing sees a value the engine never holds.
 */

import { parseGodotFloat } from './number.js';

/** `(int32_t)` of an integer Variant (`variant.h:436`, `variant.cpp:1495-1497`). */
export function toInt32(value: number): number {
  return value | 0;
}

/** `(uint32_t)` of an integer Variant (`variant.h:440`, `variant.cpp:1511-1513`). */
export function toUint32(value: number): number {
  return value >>> 0;
}

/** `(int16_t)` of a 16-bit field, for the packed cell streams (`variant.h:437`). */
export function toInt16(value: number): number {
  return ((value & 0xffff) << 16) >> 16;
}

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
export function asStoredInt(num: number): number {
  return Number.isFinite(num) ? Math.trunc(num) : NaN;
}

/**
 * A TSCN literal as the integer Godot would STORE in a `Variant::INT` slot, or
 * `null` when the text is not a literal Godot's tokenizer can read.
 *
 * Not `parseInt`. Two distinct accidents come from `parseInt` stopping at the
 * first character it cannot use, and both cleared bounds silently:
 *
 * - `2e4` read as 2. The tokenizer sets `is_float` on the `e`
 *   (variant_parser.cpp:446-448), and the FLOAT is converted on assignment, so
 *   Godot stores 20000 and any ceiling below it should have reported.
 * - `8abc` read as 8. Godot's parser cannot read that at all, so it is a format
 *   error rather than a value in range.
 *
 * A float literal in an INT slot is legal and truncates TOWARD ZERO, which is
 * what the C++ conversion does, so `5.9` is 5 and `-5.9` is -5.
 *
 * A non-finite literal READS — `inf` and `nan` are identifiers the tokenizer
 * resolves for a bare slot too (variant_parser.cpp:701-707), so the file loads
 * — but it does not FIT, so the result is NaN. See {@link asStoredInt}.
 */
export function parseGodotInt(value: string): number | null {
  // No grammar pre-test: `parseGodotFloat` returns non-null only for a
  // non-finite spelling — every one of which matches TSCN_FLOAT_RE, since the
  // pattern is built from those keys — or for text that passed TSCN_FLOAT_RE
  // itself. Nothing can fail a pre-test here and still survive the call, and
  // this runs once per ELEMENT of a packed array (a stage's GridMap carries
  // ~8,800), so the duplicate test and trim were the measurable half of it.
  const asFloat = parseGodotFloat(value);
  return asFloat === null ? null : asStoredInt(asFloat);
}

/**
 * One matched component of an `i`-suffixed composite, as the integer Godot
 * stores — or `null` when it cannot be stored as one.
 *
 * Takes a capture the finite grammar ALREADY matched, so it reads with a bare
 * `parseFloat`; text straight from a file goes through {@link parseGodotInt}.
 * `null` for a non-finite component, so the decoder takes its documented
 * warn-then-fall-back path rather than handing `Infinity` to a render path.
 */
export function storedInt(text: string | undefined): number | null {
  const num = parseFloat(text ?? '');
  return Number.isFinite(num) ? Math.trunc(num) : null;
}
