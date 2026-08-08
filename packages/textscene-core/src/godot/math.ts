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

/**
 * `Math::smoothstep` (math_funcs.h:568-577), the clamping Hermite interpolation
 * GLSL spells the same way.
 *
 * The degenerate branch is the whole reason this is not two lines. Godot guards
 * it with `is_equal_approx`, not `==`, so edges merely CLOSE together take the
 * step rather than dividing by a near-zero span; and it compares `p_s <= p_from`,
 * so `x` exactly at the edge reads 0 rather than 1. It also answers an INVERTED
 * pair (`p_from > p_to`) from the other side, which a single `x < from` cannot.
 *
 * Two domains had hand-rolled this — the noise-texture layer blend and the
 * decal's geometric fade — and both got all three of those wrong the same way,
 * having been written from the formula rather than from the engine.
 */
export function smoothstep(from: number, to: number, x: number): number {
  if (isEqualApprox(from, to)) {
    if (from <= to) return x <= from ? 0 : 1;
    return x <= to ? 1 : 0;
  }
  const s = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return s * s * (3 - 2 * s);
}
