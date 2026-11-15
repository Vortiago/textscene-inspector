import { stringNum } from '../../godot/string/stringNumber.js';
import { stringToFloat } from '../../godot/string/strtod.js';

/**
 * The text Godot's compiler writes for a float constant: `f2sp0(rtos(value))`
 * (`shader_compiler.cpp:180`), which adds `.0` to a text with no point.
 */
function godotFloatText(value: number): string {
  return withPoint(stringNum(value));
}

function withPoint(text: string): string {
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
}

/**
 * The 32-bit float Godot holds for a float literal (`Scalar::real`), from its own reader. Throws
 * for a value whose text no GLSL compiler reads, so Godot's shader fails to compile.
 */
export function godotLiteralScalar(literal: string): number {
  const scalar = Math.fround(stringToFloat(literal));
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
  return text.startsWith('0x') ? Number.parseInt(text.slice(2), 16) : stringToFloat(text);
}

/** The largest magnitude a double holds in a 64-bit integer, past which x86-64 gives its "indefinite" value. */
const INT64_LIMIT = 2 ** 63;

/**
 * The `uint` lane of a `uint` literal (`shader_language.cpp:6010`): x86-64 truncates the double to
 * 64 bits and keeps the low 32, so a value past 2^32 wraps, and NaN or a value past 2^63 gives 0.
 */
export function godotUintScalar(constant: number): number {
  const truncated = Math.trunc(constant);
  if (!(Math.abs(truncated) < INT64_LIMIT)) return 0;
  return Number(BigInt(truncated) & 0xffffffffn);
}
