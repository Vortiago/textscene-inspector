/**
 * Fixed-width integer narrowing, as the engine does it on a property write.
 *
 * Variant INT is int64, so narrowing is a per-SLOT fact — the setter's argument
 * type or a container's element type — never a parse fact. Godot itself
 * serialises a negative enum in its unsigned form (`clip_children = -1` is
 * written `4294967295`), so a reader that skips the narrowing sees a value the
 * engine never holds.
 *
 * Unlike float->int, this is portable: int64->int32 of a value inside uint32
 * wraps on every platform Godot ships.
 */

/** `(int32_t)` of an integer Variant. */
export function toInt32(value: number): number {
  return value | 0;
}

/** `(uint32_t)` of an integer Variant. */
export function toUint32(value: number): number {
  return value >>> 0;
}

/** `(int16_t)` of a 16-bit field, for the packed cell streams. */
export function toInt16(value: number): number {
  return ((value & 0xffff) << 16) >> 16;
}
