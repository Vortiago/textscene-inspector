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
 * `CLAMP` (typedefs.h:138-141): `m_a < m_min ? m_min : (m_a > m_max ? m_max : m_a)`.
 *
 * Not `Math.min(Math.max(...))`: that answers `min` for a NaN input where the
 * macro's two comparisons both fail and hand the value straight back.
 */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * `Math::round` (`core/math/math_funcs.h:625-630`): half away from ZERO, where
 * JavaScript's `Math.round` breaks a tie toward positive infinity. The two
 * differ on every negative half, which a glyph advance and a clip rect both
 * reach whenever a Control hangs off the top or left of the canvas.
 */
export function round(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * `Math::lerp` (`core/math/math_funcs.h`): `p_from + (p_to - p_from) * p_weight`.
 *
 * Spelled this way rather than as `from * (1 - t) + to * t`: the two differ in
 * the last bits, and every port here is compared against numbers Godot printed.
 */
export function lerp(from: number, to: number, weight: number): number {
  return from + (to - from) * weight;
}

/**
 * `Math::deg_to_rad` (`core/math/math_funcs.h`): `p_y * (Math_PI / 180.0)`.
 *
 * Godot serialises several rotations in degrees (`Node2D.rotation_degrees`,
 * every `*_degrees` particle parameter) and converts on the way in, so the
 * conversion is an engine fact rather than a rendering convenience.
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * `SIGN` (typedefs.h:123-126): `m_v > 0 ? +1 : (m_v < 0 ? -1 : 0)`.
 *
 * Not `Math.sign`, and the gap is NaN. Both of the engine's comparisons are
 * false for it, so `SIGN(nan)` falls through to 0 while `Math.sign(nan)` is
 * NaN — and `nan` is a float literal Godot writes and reloads, so it reaches
 * every determinant computed off a serialised transform. The two agree
 * everywhere else, including on the zero that `Basis::get_scale`
 * (basis.cpp:321-322) and `Transform2D::get_scale` (transform_2d.cpp:115-118)
 * multiply a degenerate transform's signed axis by.
 */
export function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
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

/**
 * `Basis::determinant()` (`basis.h:350-354`) over the nine row-major
 * components, expanded along the first COLUMN exactly as the engine writes it.
 *
 * The grouping is transcribed rather than simplified. Expanding along the first
 * ROW is the same number for every finite basis and not for one carrying `inf`:
 * `Transform3D(1, inf, 0, 0, 1, 1, 1, 0, 1, …)` reaches `1 - 0*inf + 1*inf`
 * (NaN, signing to 0) one way and `1 + inf` (signing to +1) the other, which is
 * the difference between reporting Godot's scale and reporting one it never
 * holds.
 *
 * Here rather than beside either caller because both the linter's scale rules
 * and the renderer's transform decomposition ask it, and `Basis::get_scale`'s
 * three-valued `SIGN` makes the answer at exactly 0 load-bearing for both.
 */
export function basisDeterminant(
  a: number, b: number, c: number,
  d: number, e: number, f: number,
  g: number, h: number, i: number
): number {
  return a * (e * i - h * f) - d * (b * i - h * c) + g * (b * f - e * c);
}
