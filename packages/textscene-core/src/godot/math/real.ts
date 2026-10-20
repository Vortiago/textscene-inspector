/**
 * `real_t` storage. An official build defines no `REAL_T_IS_DOUBLE` (`math_defs.h:143-146`),
 * so a `real_t` field, and every Vector, Rect2 and Transform component, holds single precision.
 */

import type { Vector2, Vector3 } from './vector.js';

/** The value a `real_t` field holds after `value` is assigned to it. */
export function storedReal(value: number): number {
  return Math.fround(value);
}

/** The vector a `Vector2` field holds after `value` is assigned to it. */
export function storedVector2(value: Vector2): Vector2 {
  return { x: storedReal(value.x), y: storedReal(value.y) };
}

/** The vector a `Vector3` field holds after `value` is assigned to it. */
export function storedVector3(value: Vector3): Vector3 {
  return { x: storedReal(value.x), y: storedReal(value.y), z: storedReal(value.z) };
}

/** Single precision needs at most nine significant digits to read back unchanged. */
const MAX_REAL_DIGITS = 9;

/**
 * A normal float32 is within half an ulp (6e-8 relative) of its shortest spelling, under half a
 * unit of six digits, so six digits already round to that spelling. A denormal holds fewer bits.
 */
const NORMAL_REAL_MIN = 2 ** -126;
const NORMAL_REAL_FIRST_DIGITS = 6;

/**
 * The shortest decimal text that reads back as the same `real_t`, for a message that names a
 * stored value: `0.99`, not the `0.9900000095367432` a double prints.
 */
export function formatReal(value: number): string {
  if (Number.isNaN(value)) return 'nan';
  if (!Number.isFinite(value)) return value > 0 ? 'inf' : '-inf';
  const firstDigits = Math.abs(value) >= NORMAL_REAL_MIN ? NORMAL_REAL_FIRST_DIGITS : 1;
  for (let digits = firstDigits; digits < MAX_REAL_DIGITS; digits++) {
    const shortest = Number(value.toPrecision(digits));
    if (storedReal(shortest) === value) return String(shortest);
  }
  return String(Number(value.toPrecision(MAX_REAL_DIGITS)));
}
