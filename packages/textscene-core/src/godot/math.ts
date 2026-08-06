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

/**
 * `Math::is_equal_approx` (math_funcs.h:529-540): exact equality first, then a
 * tolerance of `CMP_EPSILON * abs(a)` floored at `CMP_EPSILON`.
 *
 * The exact-equality branch is not an optimisation — Godot's own comment says it
 * is "required to handle 'infinity' values", since `abs(inf - inf)` is NaN and
 * every comparison against NaN is false. Drop it and two infinities of the same
 * sign stop comparing equal.
 *
 * The tolerance is RELATIVE to the left operand and therefore ASYMMETRIC:
 * `isEqualApprox(a, b)` is not always `isEqualApprox(b, a)`. That is Godot's
 * behaviour, not an oversight here, so callers must pass the operands in the
 * same order the engine does.
 *
 * Three sites had hand-rolled this, and one spelled the tolerance as a bare
 * `1e-5` rather than naming the constant.
 */
export function isEqualApprox(a: number, b: number): boolean {
  if (a === b) return true;
  const tolerance = Math.max(CMP_EPSILON * Math.abs(a), CMP_EPSILON);
  return Math.abs(a - b) < tolerance;
}
