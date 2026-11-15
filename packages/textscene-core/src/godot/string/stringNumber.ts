/** `String::num` and `String::num_real` (ustring.cpp:1405, 1572): a double written as Godot writes it. */

import { doubleToInt64 } from '../variant/cInteger.js';

/** The decimals `String::num` writes by default (`core/string/ustring.cpp:1419`). */
const DEFAULT_DECIMALS = 14;

/** The decimals `String::num_real(float)` starts from (`ustring.cpp:1600`). */
const FLOAT_DECIMALS = 6;

/** The most decimals `String::num` writes (`ustring.cpp:61`). */
const MAX_DECIMALS = 32;

/**
 * `String::num(value, decimals)`: `printf("%.<n>lf")`, the zeros after the first decimal trimmed.
 * A negative `decimals` is Godot's `rtos`: 14 less one for each power of ten over 10.
 */
export function stringNum(value: number, decimals = -1): string {
  if (Number.isNaN(value)) return 'nan';
  if (!Number.isFinite(value)) return value < 0 ? '-inf' : 'inf';
  let places = decimals;
  if (places < 0) {
    places = DEFAULT_DECIMALS;
    const magnitude = Math.abs(value);
    if (magnitude > 10) places -= Math.floor(Math.log10(magnitude));
  }
  places = Math.min(places, MAX_DECIMALS);
  // `%lf` with no precision writes six decimals (`ustring.cpp:1435`).
  return trimZeros(fixedPoint(value, places < 0 ? 6 : places));
}

/** `String::num_real(double)`: a whole value as an integer, with `.0` when `trailing`. */
export function numReal(value: number, trailing: boolean): string {
  return numRealWith(value, trailing, Math.log10, DEFAULT_DECIMALS);
}

/** `String::num_real(float)`, the overload a `real_t` component takes: 6 decimals, its log10 in float. */
export function numRealFloat(value: number, trailing: boolean): string {
  return numRealWith(value, trailing, (magnitude) => Math.fround(Math.log10(magnitude)), FLOAT_DECIMALS);
}

function numRealWith(value: number, trailing: boolean, log10: (magnitude: number) => number, base: number) {
  if (!Number.isFinite(value)) return stringNum(value, 0);
  if (value === Number(doubleToInt64(value))) return `${doubleToInt64(value)}${trailing ? '.0' : ''}`;
  let decimals = base;
  const magnitude = Math.abs(value);
  if (magnitude > 10) decimals -= Math.floor(log10(magnitude));
  return stringNum(value, decimals);
}

/** Trailing zeros go, but one zero stays after the point (`ustring.cpp:1470-1494`). */
function trimZeros(text: string): string {
  if (!text.includes('.')) return text;
  const trimmed = text.replace(/0+$/, '');
  return trimmed.endsWith('.') ? `${trimmed}0` : trimmed;
}

/**
 * `printf("%.<decimals>lf", value)`: the exact decimal value of the double, rounded half to even
 * at `decimals` places, as glibc rounds. `toFixed` rounds an exact half up, so it differs on
 * those halves.
 */
function fixedPoint(value: number, decimals: number): string {
  const negative = value < 0 || Object.is(value, -0);
  const { numerator, denominator } = exactRatio(Math.abs(value));
  const scaled = numerator * 10n ** BigInt(decimals);
  let quotient = scaled / denominator;
  const remainder = scaled % denominator;
  const twice = remainder * 2n;
  if (twice > denominator || (twice === denominator && quotient % 2n === 1n)) quotient += 1n;
  const digits = quotient.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);
  return `${negative ? '-' : ''}${whole}${decimals > 0 ? `.${fraction}` : ''}`;
}

/** The finite non-negative double `value` as an exact fraction with a power-of-two denominator. */
function exactRatio(value: number): { numerator: bigint; denominator: bigint } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
  const exponentBits = Number((bits >> 52n) & 0x7ffn);
  const fractionBits = bits & ((1n << 52n) - 1n);
  const mantissa = exponentBits === 0 ? fractionBits : fractionBits | (1n << 52n);
  const exponent = (exponentBits === 0 ? 1 : exponentBits) - 1075;
  return exponent >= 0
    ? { numerator: mantissa << BigInt(exponent), denominator: 1n }
    : { numerator: mantissa, denominator: 1n << BigInt(-exponent) };
}
