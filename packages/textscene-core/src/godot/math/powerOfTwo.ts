/**
 * Godot's rounding up to a power of two, as its atlases size themselves.
 */

/**
 * `next_power_of_2` (`core/typedefs.h:179-192`) and `nearest_power_of_2_templated`
 * (`core/math/math_funcs_binary.h:131-147`) on an integer: zero stays zero, and a fraction
 * truncates first.
 */
export function nextPowerOfTwo(value: number): number {
  const whole = Math.trunc(value);
  if (whole <= 0) return 0;
  let power = 1;
  while (power < whole) power *= 2;
  return power;
}
