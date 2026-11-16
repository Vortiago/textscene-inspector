import * as double from '../../math/doubleMath.js';
import {
  cPow,
  degToRad,
  ease,
  isEqualApprox,
  isZeroApprox,
  radToDeg,
  round,
  sign,
  smoothstep,
  snapped,
} from '../../math/math.js';
import { doubleToInt64, remainderInt64 } from '../cInteger.js';
import { variant } from '../value/variant.js';
import type { TypedFunction } from './utilityFunction.js';

type Doubles = (...values: number[]) => number;

const real =
  (math: Doubles): TypedFunction =>
  (args) =>
    variant('FLOAT', math(...(args as number[])));

const integer =
  (math: (...values: bigint[]) => bigint): TypedFunction =>
  (args) =>
    variant('INT', math(...(args as bigint[])));

const toInteger =
  (math: (value: number) => number): TypedFunction =>
  ([value]) =>
    variant('INT', doubleToInt64(math(value as number)));

const test =
  (predicate: (...values: number[]) => boolean): TypedFunction =>
  (args) =>
    variant('BOOL', predicate(...(args as number[])));

const int64 = (value: bigint) => BigInt.asIntN(64, value);

// `Math::posmod` returns 0 for a zero divisor and prints an error.
function posmod(x: bigint, y: bigint): bigint {
  if (y === 0n) return 0n;
  const value = remainderInt64(x, y);
  return (value < 0n && y > 0n) || (value > 0n && y < 0n) ? int64(value + y) : value;
}

// `nearest_power_of_2_templated` on the uint64 bits, returned as int64.
function nearestPowerOfTwo(x: bigint): bigint {
  let bits = BigInt.asUintN(64, x - 1n);
  for (let shift = 1n; shift < 64n; shift <<= 1n) bits |= bits >> shift;
  return int64(bits + 1n);
}

const maxOf = <T extends number | bigint>(x: T, y: T): T => (x > y ? x : y);
const minOf = <T extends number | bigint>(x: T, y: T): T => (x < y ? x : y);
const clampOf = <T extends number | bigint>(x: T, min: T, max: T): T => (x < min ? min : x > max ? max : x);

export const SCALAR_MATH: Readonly<Record<string, TypedFunction>> = {
  sin: real(Math.sin),
  cos: real(Math.cos),
  tan: real(Math.tan),
  sinh: real(Math.sinh),
  cosh: real(Math.cosh),
  tanh: real(Math.tanh),
  asin: real(double.asin),
  acos: real(double.acos),
  atan: real(Math.atan),
  atan2: real(Math.atan2),
  asinh: real(Math.asinh),
  acosh: real(double.acosh),
  atanh: real(double.atanh),
  sqrt: real(Math.sqrt),
  fmod: real((x, y) => x! % y!),
  fposmod: real(double.fposmod),
  posmod: integer(posmod),
  floorf: real(Math.floor),
  floori: toInteger(Math.floor),
  ceilf: real(Math.ceil),
  ceili: toInteger(Math.ceil),
  roundf: real(round),
  roundi: toInteger(round),
  absf: real(Math.abs),
  absi: integer((x) => int64(x < 0n ? -x : x)),
  signf: real(sign),
  signi: integer((x) => (x > 0n ? 1n : x < 0n ? -1n : 0n)),
  snappedf: real(snapped),
  snappedi: ([x, step]) => variant('INT', doubleToInt64(snapped(x as number, Number(step)))),
  pow: real(cPow),
  log: real(Math.log),
  exp: real(Math.exp),
  is_nan: test(Number.isNaN),
  is_inf: test((x) => x === Infinity || x === -Infinity),
  is_equal_approx: test(isEqualApprox),
  is_zero_approx: test(isZeroApprox),
  is_finite: test(Number.isFinite),
  ease: real(ease),
  step_decimals: ([step]) => variant('INT', BigInt(double.stepDecimals(step as number))),
  lerpf: real(double.lerp),
  cubic_interpolate: real(double.cubicInterpolate),
  cubic_interpolate_angle: real(double.cubicInterpolateAngle),
  cubic_interpolate_in_time: real(double.cubicInterpolateInTime),
  cubic_interpolate_angle_in_time: real(double.cubicInterpolateAngleInTime),
  bezier_interpolate: real(double.bezierInterpolate),
  bezier_derivative: real(double.bezierDerivative),
  angle_difference: real(double.angleDifference),
  lerp_angle: real(double.lerpAngle),
  inverse_lerp: real(double.inverseLerp),
  remap: real(double.remap),
  smoothstep: real(smoothstep),
  move_toward: real(double.moveToward),
  rotate_toward: real(double.rotateToward),
  deg_to_rad: real(degToRad),
  rad_to_deg: real(radToDeg),
  linear_to_db: real(double.linearToDb),
  db_to_linear: real(double.dbToLinear),
  wrapi: integer(double.wrapi),
  wrapf: real(double.wrapf),
  maxi: integer(maxOf),
  maxf: real(maxOf),
  mini: integer(minOf),
  minf: real(minOf),
  clampi: integer(clampOf),
  clampf: real(clampOf),
  nearest_po2: integer(nearestPowerOfTwo),
  pingpong: real(double.pingpong),
};
