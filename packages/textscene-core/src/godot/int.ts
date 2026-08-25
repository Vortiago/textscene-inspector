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
 * container's element type — never a parse fact, so it goes IN as
 * {@link IntWidth} rather than being applied to a result. Godot serialises a
 * negative enum in its unsigned form (`clip_children = -1` is written
 * `4294967295`), so a reader that skips the narrowing sees a value the engine
 * never holds.
 *
 * Every reader here narrows, including the ones the RENDER path uses. The
 * previewer and the linter must agree on what one literal means: while
 * `storedInt` did not narrow, `z_index = 4294967295` drew at z = 4.29e8 —
 * behind the camera — and the linter, reading the -1 Godot holds, found it in
 * range and said nothing at all.
 */

import { matchedFloat, parseGodotFloat } from './number.js';
import { compositeTypeName, isConvertedSpelling } from './variantConversion.js';

/** `(int32_t)` of an integer Variant (`variant.h:436`, `variant.cpp:1495-1497`). */
export function toInt32(value: number): number {
  return value | 0;
}

/** `(uint32_t)` of an integer Variant (`variant.h:440`, `variant.cpp:1511-1513`). */
export function toUint32(value: number): number {
  return value >>> 0;
}

/** `(uint8_t)` of an integer Variant (`variant.h:442`, `variant.cpp:1519-1521`). */
export function toUint8(value: number): number {
  return value & 0xff;
}

/** `(int16_t)` of a 16-bit field, for the packed cell streams (`variant.h:437`). */
export function toInt16(value: number): number {
  return ((value & 0xffff) << 16) >> 16;
}

/** A `PackedByteArray` element: `Vector<uint8_t>` (`variant_parser.cpp:650`). */
const UINT8_MAX = 255;
const INT32_MIN = -2147483648;
/** The widest value an `int32_t` slot holds; above it only a `uint32_t` can. */
export const INT32_MAX = 2147483647;
const UINT32_MAX = 4294967295;
/**
 * int64's own range is [-2^63, 2^63), but no double spells it: 2^63 - 1 is not
 * representable, and past 2^53 the number we hold is no longer the integer the
 * file states. The reader's limit is the tighter of the two, so it IS the bound
 * — and `storedFromFloat` refuses past it for every width anyway.
 */
const INT64_MIN = Number.MIN_SAFE_INTEGER;
const INT64_MAX = Number.MAX_SAFE_INTEGER;

/**
 * The C++ type on the far side of the write, which is a per-SLOT fact: the
 * setter's argument type, or a container's element type.
 *
 * It decides BOTH halves of the conversion, which is why it cannot be applied
 * afterwards. Narrowing an already-refused value is too late (the refusal has
 * happened), and refusing before the width is known asks the wrong question —
 * `uint32_t(4294967295.0)` is perfectly defined, and reading every slot as
 * int32 rejected the exact ceiling `PROPERTY_HINT_RANGE` declares for it.
 *
 * Per-slot means declared twice — once on the validator (`intSlot.width`) and
 * once at the reader's call site — since ADR-0001 keeps the two apart at
 * runtime. `intSlotWidth.guard.test.ts` holds the pair to one answer.
 */
export type IntWidth = 'uint8' | 'int32' | 'uint32' | 'int64';

/**
 * What a slot of each width HOLDS: the C++ type's own range.
 *
 * A FLOAT literal converts into this and no further — outside it the C++
 * conversion is undefined, which is why `uint32_t(4294967295.0)` is fine and
 * `uint32_t(-1.0)` is not.
 */
const REPRESENTABLE: Record<IntWidth, readonly [number, number]> = {
  uint8: [0, UINT8_MAX],
  int32: [INT32_MIN, INT32_MAX],
  uint32: [0, UINT32_MAX],
  int64: [INT64_MIN, INT64_MAX],
};

/**
 * What a slot of each width ROUND-TRIPS: both spellings of every bit pattern
 * it holds.
 *
 * Godot serialises the same 32 bits as either signedness depending on the
 * getter — measured, `Node2D.visibility_layer = -1` is written back as
 * `4294967295` — so an INT literal in the opposite spelling is the file being
 * read as written, not a value being altered. One step further out it IS an
 * alteration: nothing writes `4294967296`, and the engine holding 0 for it is
 * exactly the error tier ADR-0032 describes.
 *
 * Symmetric in MEANING rather than in magnitude. The band looks lopsided
 * because two's complement is: `[-2^31, 2^32)` is every 32-bit pattern spelled
 * both ways, and `-3000000000` is outside it in the same sense `4294967296` is.
 */
const ROUND_TRIPS: Record<IntWidth, readonly [number, number]> = {
  // No wider band at byte width, and the difference is empirical rather than a
  // choice: the 32-bit rows exist because Godot's serialiser writes the opposite
  // spelling of the same bits, and nothing writes the opposite spelling of a
  // byte. `variant_parser.cpp:2408` emits `itos(ptr[i])` off a `const uint8_t *`,
  // so no Godot-written file holds a negative byte, and `-1` is an alteration
  // (measured: `PackedByteArray(-1, 0)` stores `[255, 0]`), not a spelling.
  uint8: [0, UINT8_MAX],
  int32: [INT32_MIN, UINT32_MAX],
  uint32: [INT32_MIN, UINT32_MAX],
  int64: [INT64_MIN, INT64_MAX],
};

/**
 * `int64_t`'s OWN range, which is wider than any of the bounds above.
 *
 * `INT64_MIN`/`INT64_MAX` here are the READER's limit — the safe-integer band,
 * past which a double stops being the integer the text states. The C++ type
 * runs to 2^63, and the gap between the two is the band where Godot holds the
 * value exactly and this module cannot.
 *
 * The top is INCLUSIVE of the double `2^63`, which is not the type's own limit
 * but the nearest double to it. Every one of the top ~1024 int64 values —
 * `9223372036854775807` among them — rounds to exactly `2^63` when read, so an
 * exclusive bound refused INT64_MAX itself as an engine alteration, at the
 * error tier that fails `lint:scenes` on a value Godot stores exactly. The one
 * spelling that genuinely saturates and now only warns (`9223372036854775808`)
 * is indistinguishable from those after the read, and the warning's text — the
 * value is outside what this linter reads exactly, so no bound is checked —
 * is true of it either way.
 */
const INT64_TRUE_MIN = -(2 ** 63);
const INT64_TRUE_LIMIT = 2 ** 63;

/**
 * Whether a refusal at this width is THIS reader's limit rather than an
 * alteration by the engine.
 *
 * {@link storedFromFloat} answers both with the same NaN, and they carry
 * opposite claims. At uint8/int32/uint32 the C++ type is narrower than a
 * double, so NaN always means the engine altered the value. At int64 it is
 * wider, and inside the type's own range `_to_int` carries the value intact —
 * the file states exactly what Godot stores, and only the double loses it.
 *
 * False outside that range at every width: past 2^63 a FLOAT literal is
 * undefined behaviour (`variant.h:369-370`) and an INT literal saturates
 * (`ustring.cpp:2650-2658`), and both genuinely alter the value.
 */
export function readerLimitedInt(asFloat: number, width: IntWidth): boolean {
  if (width !== 'int64') return false;
  return Number.isFinite(asFloat) && asFloat >= INT64_TRUE_MIN && asFloat <= INT64_TRUE_LIMIT;
}

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
export function ruleInt(
  raw: string | undefined,
  whenAbsent: number | null = null,
  width: IntWidth = 'int32',
  /** See {@link storedFromFloat}: set for a component of a float-typed composite. */
  alwaysFloatBranch = false
): number | null {
  if (raw === undefined) return whenAbsent;
  const parsed = parseGodotInt(raw, width, alwaysFloatBranch);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

/**
 * The array COUNT a rule may compare against, or `null` for text it must not.
 *
 * Every serialised array count in Godot opens its setter with
 * `ERR_FAIL_COND(p_count < 0)` — `ItemList` (item_list.cpp:527), `PopupMenu`
 * (popup_menu.cpp:2698), `FileDialog` (file_dialog.cpp:2039), `TabBar`
 * (tab_bar.cpp:745), `OptionButton` (option_button.cpp:310), `MenuButton`
 * (menu_button.cpp:124), and the skeleton modifiers through
 * `_set_setting_count` (ik_modifier_3d.h:98). The write is refused outright, so
 * the array keeps the length it already had — at load, the class default.
 *
 * A rule that compares indices against the AUTHORED number instead names a
 * length the engine never stored, and does it beside the `enforced:` validator
 * that already reported the same value.
 */
export function ruleCount(raw: string | undefined, whenAbsent = 0): number | null {
  const count = ruleInt(raw, whenAbsent);
  // `null` still means unreadable, and still travels: phase 1 has already
  // reported that text, and a rule owes silence rather than a second
  // diagnostic naming a number it had to invent.
  if (count === null) return null;
  return count < 0 ? whenAbsent : count;
}

/**
 * One matched component of an `i`-suffixed composite, as the integer Godot
 * stores — or `null` when no int32 can hold it.
 *
 * NARROWED, like every other reader here. `Vector2i`/`Vector3i`/`Vector4i`/
 * `Rect2i` components are all `int32_t` (`vector2i.h:56-57`), and skipping the
 * narrowing put the renderer and the linter on different numbers for the same
 * text: the linter read `z_index = 4294967295` as -1 and said nothing, while
 * the previewer placed the node at z = 4.29e8, behind the camera.
 *
 * Takes a capture the finite grammar ALREADY matched, so the READ is a bare
 * `parseFloat`; text straight from a file goes through {@link parseGodotInt}.
 */
export function storedInt(
  text: string | undefined,
  /** See {@link storedFromFloat}: set for a component of a float-typed composite. */
  alwaysFloatBranch = false
): number | null {
  const num = parseFloat(text ?? '');
  if (!Number.isFinite(num)) return null;
  const stored = storedFromFloat(num, text ?? '', 'int32', alwaysFloatBranch);
  return Number.isNaN(stored) ? null : stored;
}

/**
 * The matched components of a composite in a FLOAT-typed slot, each read the
 * way the SPELLING stores it.
 *
 * `slotTupleRegex` admits the `i`-suffixed spelling because
 * `can_convert_strict` converts it, but the two spellings do not store the same
 * numbers. `Vector2i(...)` arguments go through `_parse_construct<int32_t>`
 * (`variant_parser.cpp:721-733`), so each is narrowed to int32 BEFORE the
 * widening into the float slot runs: `Vector2i(4294967295, 0)` reaches a
 * `Vector2` slot as `(-1, 0)`, and `Vector2i(1.5, 0)` as `(1, 0)`. Reading
 * those captures as plain floats placed the node 4.29e9 units away.
 *
 * An unstorable component comes back NaN, so the caller's existing `allFinite`
 * check takes the warn-then-fall-back path it already has for a literal the
 * grammar refuses.
 */
export function slotComponents(
  literal: string,
  /** The slot's own type name, e.g. `Vector2` — NOT the spelling in the file. */
  floatTypeName: string,
  captures: readonly (string | undefined)[]
): number[] {
  const asInt = isConvertedSpelling(floatTypeName, compositeTypeName(literal));
  return captures.map((capture) =>
    asInt ? (storedInt(capture) ?? NaN) : matchedFloat(capture ?? '')
  );
}
