/**
 * Godot's float literal chain, which decides the value a shader's literal draws with. Godot reads
 * the text with its own decimal reader, keeps a 32-bit float, and writes the float back as text
 * with 14 decimals for the GPU's compiler (`shader_compiler.cpp:180`), which reads it as a
 * double. So `1e-20` draws as 0.
 */

import { godotStrtod } from '../../godot/string/strtod.js';

/** The decimals `String::num` writes by default (`core/string/ustring.cpp:1419`). */
const DEFAULT_DECIMALS = 14;

/** The most decimals `String::num` writes (`ustring.cpp:61`). */
const MAX_DECIMALS = 32;

/**
 * The text Godot's compiler writes for a float constant: `f2sp0(rtos(value))`
 * (`shader_compiler.cpp:180`), which adds `.0` to a text with no point.
 */
function godotFloatText(value: number): string {
  return withPoint(godotNumberText(value));
}

/**
 * Godot's `rtos`, `String::num` with its default decimals (`core/string/ustring.cpp:1405`):
 * `printf("%.<n>lf")` with 14 decimals less one for each power of ten over 10, and the zeros
 * after the first decimal trimmed. Godot's messages write a number token this way.
 */
export function godotNumberText(value: number): string {
  if (Number.isNaN(value)) return 'nan';
  if (!Number.isFinite(value)) return value < 0 ? '-inf' : 'inf';
  let decimals = DEFAULT_DECIMALS;
  const magnitude = Math.abs(value);
  if (magnitude > 10) decimals -= Math.floor(Math.log10(magnitude));
  decimals = Math.min(decimals, MAX_DECIMALS);
  // `%lf` with no precision writes six decimals (`ustring.cpp:1435`).
  return trimZeros(fixedPoint(value, decimals < 0 ? 6 : decimals));
}

function withPoint(text: string): string {
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
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

/**
 * The 32-bit float Godot holds for a float literal (`Scalar::real`), from its own reader. Throws
 * for a value whose text no GLSL compiler reads, so Godot's shader fails to compile.
 */
export function godotLiteralScalar(literal: string): number {
  const scalar = Math.fround(godotStrtod(literal));
  godotConstantDouble(scalar);
  return scalar;
}

/**
 * The double the GPU's compiler reads from the text Godot writes for the 32-bit float `scalar`.
 * glslang folds constants in this precision and rounds once, when it writes the SPIR-V constant.
 */
export function godotConstantDouble(scalar: number): number {
  const text = godotFloatText(scalar);
  if (/inf|nan/.test(text))
    throw new Error(`Godot writes this constant as "${text}", which no GLSL compiler reads`);
  return Number(text);
}

/**
 * The double Godot's tokenizer holds for an integer literal's text, suffix stripped
 * (`shader_language.cpp:887`): `hex_to_int` for `0x`, the decimal reader otherwise.
 */
export function godotIntegerConstant(text: string): number {
  return text.startsWith('0x') ? Number.parseInt(text.slice(2), 16) : godotStrtod(text);
}

/** The largest magnitude a double holds in a 64-bit integer, past which x86-64 gives its "indefinite" value. */
const INT64_LIMIT = 2 ** 63;

/**
 * The `int` lane of an `int` literal: the double cast to a 32-bit integer
 * (`shader_language.cpp:6002`). x86-64's `cvttsd2si` truncates, and gives -2^31 for a value out of range.
 */
export function godotIntScalar(constant: number): number {
  const truncated = Math.trunc(constant);
  return truncated >= -(2 ** 31) && truncated < 2 ** 31 ? truncated : -(2 ** 31);
}

/**
 * The `uint` lane of a `uint` literal (`shader_language.cpp:6010`): x86-64 truncates the double to
 * 64 bits and keeps the low 32, so a value past 2^32 wraps, and NaN or a value past 2^63 gives 0.
 */
export function godotUintScalar(constant: number): number {
  const truncated = Math.trunc(constant);
  if (!(Math.abs(truncated) < INT64_LIMIT)) return 0;
  return Number(BigInt(truncated) & 0xffffffffn);
}
