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

const INT32_MIN = -2147483648;
/** The widest value an `int32_t` slot holds; above it only a `uint32_t` can. */
export const INT32_MAX = 2147483647;
const UINT32_MAX = 4294967295;

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
 * A TSCN literal as the int32 a Godot property slot STORES — three outcomes:
 * `null` when the tokenizer cannot read the text, `NaN` when it reads but the
 * slot cannot hold it, and otherwise the number the engine holds.
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
 * The storable band differs by literal type, because `_to_int` converts the two
 * on different branches. Measured on 4.6.3 (x86_64), `Node2D.light_mask`:
 *
 * ```
 * 3000000000    (INT)    -> -1294967296   int64 -> int32, wraps
 * 3e9           (FLOAT)  -> -2147483648   double -> int32, UB
 * 4294967295    (INT)    -> -1
 * 4.294967295e9 (FLOAT)  -> -2147483648   UB again
 * ```
 *
 * So an INT literal is storable across the whole 32-bit band — `[-2^31, 2^32)`,
 * the union of the signed and unsigned spellings Godot writes — while a FLOAT
 * one is defined only within int32. Outside its band the value is `NaN`: bits
 * the file states that the engine does not hold.
 */
export function parseGodotInt(value: string): number | null {
  // No grammar pre-test: `parseGodotFloat` returns non-null only for a
  // non-finite spelling — every one of which matches TSCN_FLOAT_RE, since the
  // pattern is built from those keys — or for text that passed TSCN_FLOAT_RE
  // itself. Nothing can fail a pre-test here and still survive the call, and
  // this runs once per ELEMENT of a packed array (a stage's GridMap carries
  // ~8,800), so the duplicate test and trim were the measurable half of it.
  // `parseGodotFloat` trims; `FLOAT_TYPED` looks for `.`/`e`, neither of which
  // is whitespace, so the raw text answers it just as well.
  const asFloat = parseGodotFloat(value);
  return asFloat === null ? null : storedFromFloat(asFloat, value);
}

/**
 * The int32 a slot stores, from a float the caller has ALREADY read.
 *
 * The combinators that must first decide whether a literal is whole-valued
 * hold the parsed float already; re-reading the raw text for the narrowing
 * doubled the cost of every `v.strictInt` call.
 *
 * `literal` is only consulted past int32, which is where the two `_to_int`
 * branches diverge — so the common in-band element never runs the test.
 */
export function storedFromFloat(asFloat: number, literal: string): number {
  const stored = asStoredInt(asFloat);
  if (Number.isNaN(stored) || stored < INT32_MIN) return NaN;
  if (stored > INT32_MAX && (stored > UINT32_MAX || FLOAT_TYPED.test(literal))) return NaN;
  return toInt32(stored);
}

/**
 * The int a RULE may compare, or `null` for anything it must not.
 *
 * `parseGodotInt`'s `NaN` is a signal for the VALIDATOR layer, which turns it
 * into a diagnostic. A rule that lets it through drops out of every comparison
 * instead — `frame >= NaN` is false — so the rule goes silent on exactly the
 * scene that needed it. Phase 1 already reports the unstorable value, so
 * silence is what a rule owes; `null` is how it says so.
 *
 * `whenAbsent` is the value a MISSING key stands for, for the many rules where
 * Godot's default is not zero (`hframes` is 1).
 *
 * Here rather than beside the validators because two RENDER decoders read it —
 * `gridmap/cellData.ts` and `tiles/shared/tileData.ts`, both on the webview
 * path — and reaching into `linter/validators/` for it pulled the diagnostic
 * machinery after them, which is the coupling `src/godot/` exists to avoid.
 */
export function ruleInt(raw: string | undefined, whenAbsent: number | null = null): number | null {
  if (raw === undefined) return whenAbsent;
  const parsed = parseGodotInt(raw);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
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
