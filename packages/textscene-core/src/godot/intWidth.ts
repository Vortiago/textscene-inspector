/**
 * Fixed-width integer facts: the conversions `_to_int<T>` performs and the
 * per-slot width that selects them. See `int.ts` for the whole picture.
 */


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
export const REPRESENTABLE: Record<IntWidth, readonly [number, number]> = {
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
export const ROUND_TRIPS: Record<IntWidth, readonly [number, number]> = {
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
