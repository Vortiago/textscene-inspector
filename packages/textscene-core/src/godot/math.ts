/** Engine math constants, as Godot declares them. */

/**
 * `CMP_EPSILON` (math_defs.h:50), the tolerance every `Math::is_zero_approx` compares against, and
 * in several setters the value substituted for a component that trips it. `1e-6` is ten times too
 * small: 5e-6 is zero-approx to Godot.
 */
export const CMP_EPSILON = 0.00001;

/**
 * `Math::is_zero_approx` (math_funcs.h): `abs(s) < CMP_EPSILON`, false for `nan` and `inf`, so a
 * setter guarded by it lets a non-finite value through. Validators depend on that strictness.
 */
export function isZeroApprox(value: number): boolean {
  return Math.abs(value) < CMP_EPSILON;
}

/**
 * `Math::is_equal_approx` (math_funcs.h:529-540): exact equality first, "required to handle
 * 'infinity' values" as `abs(inf - inf)` is NaN, then a tolerance of `CMP_EPSILON * abs(a)` floored at
 * `CMP_EPSILON`. Relative to the left operand, so asymmetric, as in Godot: callers pass the operands
 * in the engine's order.
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
 * `Math::round` (`core/math/math_funcs.h:625-630`): half away from zero, where `Math.round` breaks a
 * tie toward positive infinity. They differ on every negative half, which a glyph advance and a clip
 * rect reach when a Control hangs off the top or left of the canvas.
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
 * `SIGN` (typedefs.h:123-126): `m_v > 0 ? +1 : (m_v < 0 ? -1 : 0)`. Not `Math.sign`: `SIGN(nan)` is 0,
 * and Godot writes and reloads `nan`, so it reaches determinants of serialised transforms. The zero
 * is what `Basis::get_scale` (basis.cpp:321-322) and `Transform2D::get_scale`
 * (transform_2d.cpp:115-118) multiply a degenerate transform's signed axis by.
 */
export function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/**
 * `Math::smoothstep` (math_funcs.h:568-577), the clamping Hermite GLSL spells alike. The degenerate
 * branch guards with `is_equal_approx`, not `==`, so close edges step instead of dividing by a
 * near-zero span. `p_s <= p_from` reads 0 exactly at the edge, and an inverted pair (`p_from > p_to`)
 * answers from the other side.
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
 * `Basis::determinant()` (`basis.h:350-354`) over the nine row-major components, expanded along the
 * first column as the engine writes it. The first row gives the same number except with `inf`:
 * `Transform3D(1, inf, 0, 0, 1, 1, 1, 0, 1, …)` is NaN (sign 0) one way and `1 + inf` the other. Here,
 * as the linter's scale rules and the renderer's decomposition both read the answer at exactly 0.
 */
export function basisDeterminant(
  a: number, b: number, c: number,
  d: number, e: number, f: number,
  g: number, h: number, i: number
): number {
  return a * (e * i - h * f) - d * (b * i - h * c) + g * (b * f - e * c);
}
