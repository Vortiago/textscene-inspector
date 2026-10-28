/** Engine math constants, as Godot declares them. */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does. A local alias, not
// `storedReal`: scripts/godot-dfg/bake-dfg.mjs runs this file through Node's type stripping,
// which resolves no `.js` import, so this module imports nothing.
const f = Math.fround;

/** `Math::TAU` (`math_defs.h:43`): one full turn in radians. */
export const TAU = Math.PI * 2;

/**
 * `CMP_EPSILON` (math_defs.h:50), the tolerance every `Math::is_zero_approx` compares against, and
 * in several setters the value substituted for a component that trips it. `1e-6` is ten times too
 * small: 5e-6 is zero-approx to Godot.
 */
export const CMP_EPSILON = 0.00001;

/** `UNIT_EPSILON` (`math_defs.h:65`), the tolerance of `Vector3::is_normalized` in an official build. */
export const UNIT_EPSILON = 0.001;

/** The times of the key after, the key before and the key past the next, counted from a key. */
export interface KeyTimes {
  toT: number;
  preT: number;
  postT: number;
}

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

/** A colour's four channels, as `Color` holds them. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** `Color::lerp` (`core/math/color.h:110-117`): {@link lerp} on each channel, alpha included. */
export function lerpColor(from: Rgba, to: Rgba, weight: number): Rgba {
  return {
    r: lerp(from.r, to.r, weight),
    g: lerp(from.g, to.g, weight),
    b: lerp(from.b, to.b, weight),
    a: lerp(from.a, to.a, weight),
  };
}

/** The float overload of `Math::lerp` (`core/math/math_funcs.h:339-341`). */
export function lerpf(from: number, to: number, weight: number): number {
  return f(from + f(f(to - from) * weight));
}

/**
 * The float overload of `Math::remap` (`core/math/math_funcs.h:508-510`): `inverse_lerp` of the value
 * in the input range, then `lerp` into the output range, each step rounded in float.
 */
export function remapf(
  value: number,
  inStart: number,
  inStop: number,
  outStart: number,
  outStop: number
): number {
  const weight = f(f(f(value) - f(inStart)) / f(f(inStop) - f(inStart)));
  return lerpf(f(outStart), f(outStop), weight);
}

/**
 * The float overload of `Math::cubic_interpolate` (`core/math/math_funcs.h:350-356`), a
 * Catmull-Rom from `from` to `to` with the neighbours as tangents, rounded as each float
 * operation rounds.
 */
export function cubicInterpolatef(
  from: number,
  to: number,
  pre: number,
  post: number,
  weight: number
): number {
  const w2 = f(weight * weight);
  const w3 = f(w2 * weight);
  const constant = f(from * 2);
  const linear = f(f(-pre + to) * weight);
  const quadratic = f(f(f(f(f(2 * pre) - f(5 * from)) + f(4 * to)) - post) * w2);
  const cubic = f(f(f(f(-pre + f(3 * from)) - f(3 * to)) + post) * w3);
  return f(0.5 * f(f(f(constant + linear) + quadratic) + cubic));
}

/**
 * The float overload of `Math::cubic_interpolate_in_time` (`core/math/math_funcs.h:399-409`), the
 * Barry-Goldman form of a cubic through keys that sit at uneven times: `toT`, `preT` and `postT`
 * are the times of the next, previous and following key, counted from the key at `from`.
 */
export function cubicInterpolateInTimef(
  from: number,
  to: number,
  pre: number,
  post: number,
  weight: number,
  toT: number,
  preT: number,
  postT: number
): number {
  const t = lerpf(0, toT, weight);
  const a1 = lerpf(pre, from, preT === 0 ? 0 : f(f(t - preT) / -preT));
  const a2 = lerpf(from, to, toT === 0 ? 0.5 : f(t / toT));
  const a3 = lerpf(to, post, f(postT - toT) === 0 ? 1 : f(f(t - toT) / f(postT - toT)));
  const b1 = lerpf(a1, a2, f(toT - preT) === 0 ? 0 : f(f(t - preT) / f(toT - preT)));
  const b2 = lerpf(a2, a3, postT === 0 ? 1 : f(t / postT));
  return lerpf(b1, b2, toT === 0 ? 0.5 : f(t / toT));
}

/**
 * `Math::pingpong` for a float (`core/math/math_funcs.h:670-672`): `value` folded back and forth
 * between 0 and `length`.
 */
export function pingpongf(value: number, length: number): number {
  if (length === 0) return 0;
  const turns = f(f(value - length) / f(length * 2));
  const fraction = f(turns - Math.floor(turns));
  return Math.abs(f(f(f(fraction * length) * 2) - length));
}

/**
 * `Math::ease` (`core/math/math_funcs.cpp:96-119`): `x` clamped to 0..1 and bent by the curve `c`.
 * Above 1 it eases in, between 0 and 1 out, below 0 in and out, and 0 gives 0.
 */
export function ease(x: number, c: number): number {
  const clamped = clamp(x, 0, 1);
  if (c > 0) return c < 1 ? 1 - Math.pow(1 - clamped, 1 / c) : Math.pow(clamped, c);
  if (c < 0) {
    return clamped < 0.5
      ? Math.pow(clamped * 2, -c) * 0.5
      : (1 - Math.pow(1 - (clamped - 0.5) * 2, -c)) * 0.5 + 0.5;
  }
  return 0;
}

/**
 * `Math::deg_to_rad` (`core/math/math_funcs.h:321-323`): `p_y * (PI / 180.0)`.
 *
 * Godot serialises several rotations in degrees (`Node2D.rotation_degrees`,
 * every `*_degrees` particle parameter) and converts on the way in, so the
 * conversion is an engine fact rather than a rendering convenience.
 *
 * @canonical Angles
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * `Math::rad_to_deg` (`core/math/math_funcs.h:329-331`): `p_y * (180.0 / PI)`.
 *
 * @canonical Angles
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
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
 * `Math::bezier_interpolate` for `real_t` (`core/math/math_funcs.h:452-461`), which `Curve`,
 * `Vector2` and `Vector3` pick: one component of the cubic Bézier through `start`, the two control
 * values and `end`, at `t` in [0, 1]. The terms keep the engine's order and each operation rounds to
 * single precision.
 */
export function bezierInterpolatef(
  start: number,
  control1: number,
  control2: number,
  end: number,
  t: number
): number {
  const omt = f(1 - t);
  const omt2 = f(omt * omt);
  const omt3 = f(omt2 * omt);
  const t2 = f(t * t);
  const t3 = f(t2 * t);
  const second = f(f(f(control1 * omt2) * t) * 3);
  const third = f(f(f(control2 * omt) * t2) * 3);
  return f(f(f(f(start * omt3) + second) + third) + f(end * t3));
}

/**
 * `Basis::determinant()` (`basis.h:350-354`) over the nine row-major components, expanded along the
 * first column as the engine writes it. The first row gives the same number except with `inf`:
 * `Transform3D(1, inf, 0, 0, 1, 1, 1, 0, 1, …)` is NaN (sign 0) one way and `1 + inf` the other. Here,
 * as the linter's scale rules and the renderer's decomposition both read the answer at exactly 0.
 */
export function basisDeterminant(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
  h: number,
  i: number
): number {
  return a * (e * i - h * f) - d * (b * i - h * c) + g * (b * f - e * c);
}

/**
 * `Math::snapped` (`core/math/math_funcs.cpp:121-126`): the nearest multiple of `step`, a tie
 * rounding up through `floor(value / step + 0.5)`. A zero step returns the value unchanged.
 */
export function snapped(value: number, step: number): number {
  return step !== 0 ? Math.floor(value / step + 0.5) * step : value;
}

/** `Math::posmod` (`core/math/math_funcs.h:313-320`): the remainder, folded to the divisor's sign. */
export function posmod(x: number, y: number): number {
  const value = x % y;
  return (value < 0 && y > 0) || (value > 0 && y < 0) ? value + y : value;
}

/**
 * `Math::fposmodp` (`core/math/math_funcs.h:296-303`): `fmod`, folded non-negative. Adding 0 turns
 * a negative zero positive, as Godot's `value += 0.0` does.
 */
export function fposmodp(x: number, y: number): number {
  const value = x % y;
  return (value < 0 ? value + y : value) + 0;
}
