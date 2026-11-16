import { CMP_EPSILON } from './math.js';

const f = Math.fround;

const CMP_EPSILON_FLOAT = f(CMP_EPSILON);

export const sqrtf = (x: number): number => f(Math.sqrt(x));
export const sinf = (x: number): number => f(Math.sin(x));
export const cosf = (x: number): number => f(Math.cos(x));

/** `Math::fposmod` for a float: `fmodf`, moved to the sign of `y`, and `-0` made `0`. */
export function fposmodf(x: number, y: number): number {
  let value = x % y;
  if ((value < 0 && y > 0) || (value > 0 && y < 0)) value = f(value + y);
  return value + 0;
}

/** `Math::is_equal_approx` for a float: a tolerance of `CMP_EPSILON` scaled by `a`, and at least it. */
export function isEqualApproxf(a: number, b: number): boolean {
  if (a === b) return true;
  const tolerance = Math.max(f(CMP_EPSILON_FLOAT * Math.abs(a)), CMP_EPSILON_FLOAT);
  return Math.abs(f(a - b)) < tolerance;
}

export const isZeroApproxf = (x: number): boolean => Math.abs(x) < CMP_EPSILON_FLOAT;

/** `Math::bezier_derivative` for a float, each operation rounded as the engine's. */
export function bezierDerivativef(
  start: number,
  control1: number,
  control2: number,
  end: number,
  t: number
): number {
  const omt = f(1 - t);
  const omt2 = f(omt * omt);
  const t2 = f(t * t);
  const first = f(f(f(control1 - start) * 3) * omt2);
  const second = f(f(f(f(control2 - control1) * 6) * omt) * t);
  const third = f(f(f(end - control2) * 3) * t2);
  return f(f(first + second) + third);
}
