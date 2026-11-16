import { doubleToInt32, remainderInt64 } from '../variant/cInteger.js';
import { clamp, isEqualApprox, isZeroApprox, lerp, sign, TAU } from './math.js';

// Each "always does clamping" overload (math_funcs.h:97) answers outside its domain instead of NaN.
export const asin = (x: number): number => (x < -1 ? -Math.PI / 2 : x > 1 ? Math.PI / 2 : Math.asin(x));
export const acosh = (x: number): number => (x < 1 ? 0 : Math.acosh(x));
export const atanh = (x: number): number => (x <= -1 ? -Infinity : x >= 1 ? Infinity : Math.atanh(x));

// `value += 0.0` turns a negative zero positive.
export function fposmod(x: number, y: number): number {
  const value = x % y;
  return ((value < 0 && y > 0) || (value > 0 && y < 0) ? value + y : value) + 0;
}

export function cubicInterpolate(
  from: number,
  to: number,
  pre: number,
  post: number,
  weight: number
): number {
  return (
    0.5 *
    (from * 2 +
      (-pre + to) * weight +
      (2 * pre - 5 * from + 4 * to - post) * (weight * weight) +
      (-pre + 3 * from - 3 * to + post) * (weight * weight * weight))
  );
}

/** The four angles `cubic_interpolate_angle` turns so each step goes the short way. */
function shortAngles(from: number, to: number, pre: number, post: number): [number, number, number, number] {
  const fromRotation = from % TAU;
  const preDifference = (pre - fromRotation) % TAU;
  const preRotation = fromRotation + ((2 * preDifference) % TAU) - preDifference;
  const toDifference = (to - fromRotation) % TAU;
  const toRotation = fromRotation + ((2 * toDifference) % TAU) - toDifference;
  const postDifference = (post - toRotation) % TAU;
  const postRotation = toRotation + ((2 * postDifference) % TAU) - postDifference;
  return [fromRotation, toRotation, preRotation, postRotation];
}

export function cubicInterpolateAngle(
  from: number,
  to: number,
  pre: number,
  post: number,
  weight: number
): number {
  return cubicInterpolate(...shortAngles(from, to, pre, post), weight);
}

/** The Barry-Goldman cubic through keys at uneven times, counted from the key at `from`. */
export function cubicInterpolateInTime(
  from: number,
  to: number,
  pre: number,
  post: number,
  weight: number,
  toT: number,
  preT: number,
  postT: number
): number {
  const t = lerp(0, toT, weight);
  const a1 = lerp(pre, from, preT === 0 ? 0 : (t - preT) / -preT);
  const a2 = lerp(from, to, toT === 0 ? 0.5 : t / toT);
  const a3 = lerp(to, post, postT - toT === 0 ? 1 : (t - toT) / (postT - toT));
  const b1 = lerp(a1, a2, toT - preT === 0 ? 0 : (t - preT) / (toT - preT));
  const b2 = lerp(a2, a3, postT === 0 ? 1 : t / postT);
  return lerp(b1, b2, toT === 0 ? 0.5 : t / toT);
}

export function cubicInterpolateAngleInTime(
  from: number,
  to: number,
  pre: number,
  post: number,
  weight: number,
  toT: number,
  preT: number,
  postT: number
): number {
  return cubicInterpolateInTime(...shortAngles(from, to, pre, post), weight, toT, preT, postT);
}

export function bezierInterpolate(
  start: number,
  control1: number,
  control2: number,
  end: number,
  t: number
): number {
  const omt = 1 - t;
  const omt2 = omt * omt;
  const omt3 = omt2 * omt;
  const t2 = t * t;
  const t3 = t2 * t;
  return start * omt3 + control1 * omt2 * t * 3 + control2 * omt * t2 * 3 + end * t3;
}

export function bezierDerivative(
  start: number,
  control1: number,
  control2: number,
  end: number,
  t: number
): number {
  const omt = 1 - t;
  const omt2 = omt * omt;
  const t2 = t * t;
  return (control1 - start) * 3 * omt2 + (control2 - control1) * 6 * omt * t + (end - control2) * 3 * t2;
}

export function angleDifference(from: number, to: number): number {
  const difference = (to - from) % TAU;
  return ((2 * difference) % TAU) - difference;
}

export const lerpAngle = (from: number, to: number, weight: number): number =>
  from + angleDifference(from, to) * weight;

export const inverseLerp = (from: number, to: number, value: number): number => (value - from) / (to - from);

export const remap = (
  value: number,
  inStart: number,
  inStop: number,
  outStart: number,
  outStop: number
): number => lerp(outStart, outStop, inverseLerp(inStart, inStop, value));

export const moveToward = (from: number, to: number, delta: number): number =>
  Math.abs(to - from) <= delta ? to : from + sign(to - from) * delta;

// A negative delta moves no further than π away from `to`, the largest angle between two.
export function rotateToward(from: number, to: number, delta: number): number {
  const difference = angleDifference(from, to);
  const absoluteDifference = Math.abs(difference);
  return from + clamp(delta, absoluteDifference - Math.PI, absoluteDifference) * (difference >= 0 ? 1 : -1);
}

export const linearToDb = (linear: number): number => Math.log(linear) * 8.685889638065037;
export const dbToLinear = (db: number): number => Math.exp(db * 0.11512925464970228);

export function wrapf(value: number, min: number, max: number): number {
  const range = max - min;
  if (isZeroApprox(range)) return min;
  const result = value - range * Math.floor((value - min) / range);
  return isEqualApprox(result, max) ? min : result;
}

/** `Math::wrapi` in int64, where a range of -1 can crash Godot through INT64_MIN % -1. */
export function wrapi(value: bigint, min: bigint, max: bigint): bigint {
  const range = BigInt.asIntN(64, max - min);
  if (range === 0n) return min;
  const folded = BigInt.asIntN(64, remainderInt64(BigInt.asIntN(64, value - min), range) + range);
  return BigInt.asIntN(64, min + remainderInt64(folded, range));
}

export function pingpong(value: number, length: number): number {
  if (length === 0) return 0;
  const turns = (value - length) / (length * 2);
  return Math.abs((turns - Math.floor(turns)) * length * 2 - length);
}

// Each threshold sits just under its power of ten, to "compensate for floating point error".
const STEP_DECIMAL_THRESHOLDS = [
  0.9999, 0.09999, 0.009999, 0.0009999, 0.00009999, 0.000009999, 0.0000009999, 0.00000009999, 0.000000009999,
  0.0000000009999,
];

/** `Math::step_decimals` (math_funcs.cpp:60): the decimals of the fraction of `step`, at most 9. */
export function stepDecimals(step: number): number {
  const magnitude = Math.abs(step);
  const fraction = magnitude - doubleToInt32(magnitude);
  const decimals = STEP_DECIMAL_THRESHOLDS.findIndex((threshold) => fraction >= threshold);
  return decimals < 0 ? 0 : decimals;
}
