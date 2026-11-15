import { stringNum } from '../../godot/string/stringNumber.js';
import { stringToFloat } from '../../godot/string/strtod.js';

/** `f2sp0(rtos(value))` (`shader_compiler.cpp:180`) adds `.0` to a text with no point. */
function godotFloatText(value: number): string {
  return withPoint(stringNum(value));
}

function withPoint(text: string): string {
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
}

/** `Scalar::real` from Godot's reader. Throws for a text no GLSL compiler reads. */
export function godotLiteralScalar(literal: string): number {
  const scalar = Math.fround(stringToFloat(literal));
  godotConstantDouble(scalar);
  return scalar;
}

/** glslang folds constants in this precision and rounds once into the SPIR-V constant. */
export function godotConstantDouble(scalar: number): number {
  const text = godotFloatText(scalar);
  if (/inf|nan/.test(text))
    throw new Error(`Godot writes this constant as "${text}", which no GLSL compiler reads`);
  return Number(text);
}

/** `hex_to_int` for `0x`, the decimal reader otherwise, suffix stripped (`shader_language.cpp:887`). */
export function godotIntegerConstant(text: string): number {
  return text.startsWith('0x') ? Number.parseInt(text.slice(2), 16) : stringToFloat(text);
}

/** Past this magnitude x86-64 gives its indefinite 64-bit integer. */
const INT64_LIMIT = 2 ** 63;

/** x86-64 truncates to 64 bits and keeps the low 32 (:6010): NaN or past 2^63 gives 0. */
export function godotUintScalar(constant: number): number {
  const truncated = Math.trunc(constant);
  if (!(Math.abs(truncated) < INT64_LIMIT)) return 0;
  return Number(BigInt(truncated) & 0xffffffffn);
}
