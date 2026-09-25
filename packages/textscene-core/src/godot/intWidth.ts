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
 * int64's own range is [-2^63, 2^63), but past 2^53 a double no longer holds the integer the file
 * states. The reader's limit is the tighter of the two, so it is the bound, and `storedFromFloat`
 * refuses past it at every width.
 */
const INT64_MIN = Number.MIN_SAFE_INTEGER;
const INT64_MAX = Number.MAX_SAFE_INTEGER;

/**
 * The C++ type on the far side of the write, a per-slot fact: the setter's argument or a container's
 * element type. It decides both the refusal and the narrowing, so it cannot apply afterwards:
 * `uint32_t(4294967295.0)` is defined. Declared on the validator (`intSlot.width`) and at the reader's
 * call site, apart at runtime (ADR-0001). `intSlotWidth.guard.test.ts` holds the pair to one answer.
 */
export type IntWidth = 'uint8' | 'int32' | 'uint32' | 'int64';

/**
 * What a slot of each width holds, the C++ type's own range. A FLOAT literal converts into this and
 * no further, as the conversion is undefined outside it: `uint32_t(4294967295.0)` is defined and
 * `uint32_t(-1.0)` is not.
 */
export const REPRESENTABLE: Record<IntWidth, readonly [number, number]> = {
  uint8: [0, UINT8_MAX],
  int32: [INT32_MIN, INT32_MAX],
  uint32: [0, UINT32_MAX],
  int64: [INT64_MIN, INT64_MAX],
};

/**
 * What a slot of each width round-trips: both spellings of each bit pattern it holds. Godot writes 32
 * bits in either signedness by getter (measured: `Node2D.visibility_layer = -1` writes `4294967295`),
 * so that is no alteration, but `4294967296` is (ADR-0032). `[-2^31, 2^32)` is every 32-bit pattern
 * spelled both ways, so `-3000000000` is outside it as `4294967296` is.
 */
export const ROUND_TRIPS: Record<IntWidth, readonly [number, number]> = {
  // No wider band at byte width: nothing writes the opposite spelling of a byte.
  // `variant_parser.cpp:2408` emits `itos(ptr[i])` off a `const uint8_t *`, so `-1` is an alteration
  // (measured: `PackedByteArray(-1, 0)` stores `[255, 0]`), not a spelling.
  uint8: [0, UINT8_MAX],
  int32: [INT32_MIN, UINT32_MAX],
  uint32: [INT32_MIN, UINT32_MAX],
  int64: [INT64_MIN, INT64_MAX],
};

/**
 * `int64_t`'s own range. The reader stops at the safe-integer band, and Godot holds the gap to 2^63
 * exactly. The top includes the double `2^63`: the top ~1024 int64 values, `9223372036854775807`
 * among them, round to it, and an exclusive bound would call INT64_MAX an error. The saturating
 * `9223372036854775808` reads the same, and its warning (no bound is checked) is true either way.
 */
const INT64_TRUE_MIN = -(2 ** 63);
const INT64_TRUE_LIMIT = 2 ** 63;

/**
 * Whether a refusal is this reader's limit rather than an engine alteration: {@link storedFromFloat}
 * gives NaN for both. At uint8, int32 and uint32 the type is narrower than a double, so NaN means the
 * engine altered it. At int64 only the double loses a value inside the type's range. Past 2^63 a FLOAT
 * is undefined (`variant.h:369-370`) and an INT saturates (`ustring.cpp:2650-2658`), both alterations.
 */
export function readerLimitedInt(asFloat: number, width: IntWidth): boolean {
  if (width !== 'int64') return false;
  return Number.isFinite(asFloat) && asFloat >= INT64_TRUE_MIN && asFloat <= INT64_TRUE_LIMIT;
}
