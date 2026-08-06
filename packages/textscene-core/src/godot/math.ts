/** Engine math constants, as Godot declares them. */

/**
 * `CMP_EPSILON` (math_defs.h:50), the tolerance every `Math::is_zero_approx`
 * compares against — and, in several setters, the value substituted for a
 * component that trips it.
 *
 * Five sites had declared it privately and a sixth stood in with `1e-6`, which
 * is ten times too small: a component of 5e-6 IS zero-approx to Godot and was
 * not to that copy.
 */
export const CMP_EPSILON = 0.00001;

/**
 * `Math::is_zero_approx` (math_funcs.h), the predicate that tolerance serves.
 *
 * Godot's own comparison is `abs(s) < CMP_EPSILON`, which is FALSE for both
 * `nan` and `inf`: a non-finite value is not zero-approx, and a setter guarded
 * by this one lets it through. Validators depend on that, so the strictness is
 * deliberate rather than an oversight.
 */
export function isZeroApprox(value: number): boolean {
  return Math.abs(value) < CMP_EPSILON;
}
