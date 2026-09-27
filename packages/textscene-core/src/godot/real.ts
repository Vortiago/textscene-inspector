/**
 * `real_t` storage. An official build defines no `REAL_T_IS_DOUBLE` (`math_defs.h:143-146`),
 * so a `real_t` field, and every Vector, Rect2 and Transform component, holds single precision.
 */

/** The value a `real_t` field holds after `value` is assigned to it. */
export function storedReal(value: number): number {
  return Math.fround(value);
}

/** Single precision needs at most nine significant digits to read back unchanged. */
const MAX_REAL_DIGITS = 9;

/**
 * The shortest decimal text that reads back as the same `real_t`, for a message that names a
 * stored value: `0.99`, not the `0.9900000095367432` a double prints.
 */
export function formatReal(value: number): string {
  if (Number.isNaN(value)) return 'nan';
  if (!Number.isFinite(value)) return value > 0 ? 'inf' : '-inf';
  for (let digits = 1; digits < MAX_REAL_DIGITS; digits++) {
    const shortest = Number(value.toPrecision(digits));
    if (storedReal(shortest) === value) return String(shortest);
  }
  return String(Number(value.toPrecision(MAX_REAL_DIGITS)));
}
