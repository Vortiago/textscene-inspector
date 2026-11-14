/**
 * ThorVG's math (`tvgMath.h`, `tvgMath.cpp`) that a content box reads: matrices and points in
 * single precision, each operation rounded to a float as the C++ does.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */

export const f32 = Math.fround;

/** `MATH_PI` and `MATH_PI2` as floats. */
export const MATH_PI = f32(Math.PI);
export const MATH_PI2 = f32(Math.PI / 2);
/** `FLOAT_EPSILON`: the distance under which ThorVG takes two floats as equal. */
const FLOAT_EPSILON = f32(1.0e-6);

/** A row-major 3x3 matrix (`tvg::Matrix`). */
export interface Matrix {
  e11: number;
  e12: number;
  e13: number;
  e21: number;
  e22: number;
  e23: number;
  e31: number;
  e32: number;
  e33: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A matrix from its nine entries in row order, each rounded to a float. */
export function matrix(...[e11, e12, e13, e21, e22, e23, e31, e32, e33]: number[]): Matrix {
  return {
    e11: f32(e11!),
    e12: f32(e12!),
    e13: f32(e13!),
    e21: f32(e21!),
    e22: f32(e22!),
    e23: f32(e23!),
    e31: f32(e31!),
    e32: f32(e32!),
    e33: f32(e33!),
  };
}

export const identityMatrix = (): Matrix => matrix(1, 0, 0, 0, 1, 0, 0, 0, 1);

export const deg2rad = (degree: number): number => f32(degree * f32(MATH_PI / f32(180)));

export const isZero = (a: number): boolean => Math.abs(a) <= FLOAT_EPSILON;

export const isEqual = (a: number, b: number): boolean => isZero(f32(a - b));

/** `a * b + c * d + e * f`, rounded after each step as single precision C++ does it. */
const sum3 = (a: number, b: number, c: number, d: number, e: number, g: number): number =>
  f32(f32(f32(a * b) + f32(c * d)) + f32(e * g));

export function multiply(lhs: Matrix, rhs: Matrix): Matrix {
  return {
    e11: sum3(lhs.e11, rhs.e11, lhs.e12, rhs.e21, lhs.e13, rhs.e31),
    e12: sum3(lhs.e11, rhs.e12, lhs.e12, rhs.e22, lhs.e13, rhs.e32),
    e13: sum3(lhs.e11, rhs.e13, lhs.e12, rhs.e23, lhs.e13, rhs.e33),
    e21: sum3(lhs.e21, rhs.e11, lhs.e22, rhs.e21, lhs.e23, rhs.e31),
    e22: sum3(lhs.e21, rhs.e12, lhs.e22, rhs.e22, lhs.e23, rhs.e32),
    e23: sum3(lhs.e21, rhs.e13, lhs.e22, rhs.e23, lhs.e23, rhs.e33),
    e31: sum3(lhs.e31, rhs.e11, lhs.e32, rhs.e21, lhs.e33, rhs.e31),
    e32: sum3(lhs.e31, rhs.e12, lhs.e32, rhs.e22, lhs.e33, rhs.e32),
    e33: sum3(lhs.e31, rhs.e13, lhs.e32, rhs.e23, lhs.e33, rhs.e33),
  };
}

/** `pt * m`: the point the matrix moves `pt` to. */
export function transformPoint(pt: Point, m: Matrix): Point {
  return {
    x: f32(f32(f32(pt.x * m.e11) + f32(pt.y * m.e12)) + m.e13),
    y: f32(f32(f32(pt.x * m.e21) + f32(pt.y * m.e22)) + m.e23),
  };
}

/** ThorVG's own `atan2`, a polynomial fit and not the C library's. */
export function atan2(y: number, x: number): number {
  if (y === 0 && x === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const a = f32(Math.min(ax, ay) / Math.max(ax, ay));
  const s = f32(a * a);
  let r = f32(
    f32(f32(f32(f32(f32(f32(f32(-0.0464964749) * s) + f32(0.15931422)) * s) - f32(0.327622764)) * s) * a) + a
  );
  if (ay > ax) r = f32(f32(1.57079637) - r);
  if (x < 0) r = f32(f32(3.14159274) - r);
  return y < 0 ? -r : r;
}
