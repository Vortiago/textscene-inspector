import { CMP_EPSILON } from './math.js';

const f = Math.fround;

const CMP_EPSILON_FLOAT = f(CMP_EPSILON);

/**
 * `Math::sqrt` of a float: the square root rounded to float.
 *
 * @canonical A float32 square root
 */
export const sqrtf = (x: number): number => f(Math.sqrt(x));

/**
 * `Math::sin` of a float, from V8's double `Math.sin` rounded to float.
 *
 * @canonical A float32 sine or cosine
 */
export const sinf = (x: number): number => f(Math.sin(x));

/**
 * `Math::cos` of a float, from V8's double `Math.cos` rounded to float.
 *
 * @canonical A float32 sine or cosine
 */
export const cosf = (x: number): number => f(Math.cos(x));

/**
 * `Math::fposmod` for a float: `fmodf`, moved to the sign of `y`, and `-0` made `0`.
 *
 * @canonical A float32 fposmod
 */
export function fposmodf(x: number, y: number): number {
  let value = x % y;
  if ((value < 0 && y > 0) || (value > 0 && y < 0)) value = f(value + y);
  return value + 0;
}

/**
 * `Math::is_equal_approx` for a float: a tolerance of `CMP_EPSILON` scaled by `a`, and at least it.
 *
 * @canonical A float32 is_equal_approx
 */
export function isEqualApproxf(a: number, b: number): boolean {
  if (a === b) return true;
  const tolerance = Math.max(f(CMP_EPSILON_FLOAT * Math.abs(a)), CMP_EPSILON_FLOAT);
  return Math.abs(f(a - b)) < tolerance;
}

/**
 * `Math::is_zero_approx` for a float: below the float `CMP_EPSILON`.
 *
 * @canonical A float32 is_zero_approx
 */
export const isZeroApproxf = (x: number): boolean => Math.abs(x) < CMP_EPSILON_FLOAT;
