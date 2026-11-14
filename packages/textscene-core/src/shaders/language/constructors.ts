/**
 * Godot's choice of a constructor overload (`_validate_function_call`, `shader_language.cpp:3574`):
 * the first row in Godot's order whose argument types match, where a scalar constant also matches
 * a scalar type it converts to, and then each such constant converted.
 */

import { convertedScalar } from './constants.js';
import type { InstructionRow } from './instructionTable.generated.js';
import { overloadInstructions } from './instructions.js';
import type { ConstantNode, Expression } from './shaderTree.js';
import { shapeOf } from './types.js';

/** Godot matches no built-in overload of more arguments (`shader_language.cpp:3627`). */
const MAX_ARGUMENTS = 4;

export interface MatchedOverload {
  readonly row: InstructionRow;
  /** The arguments, each scalar constant of another type converted to the row's type. */
  readonly operands: readonly Expression[];
}

/** The overload of type `type` for `args`, or nothing when Godot finds none. */
export function matchedConstructor(type: string, args: readonly Expression[]): MatchedOverload | undefined {
  if (args.length > MAX_ARGUMENTS) return undefined;
  const row = overloadInstructions(type).find((candidate) => matches(candidate.args!, args));
  if (!row) return undefined;
  return { row, operands: args.map((arg, index) => converted(arg, row.args![index]!)) };
}

function matches(types: readonly string[], args: readonly Expression[]): boolean {
  return types.length === args.length && args.every((arg, index) => fits(arg, types[index]!));
}

function fits(arg: Expression, type: string): boolean {
  if (isScalarConstant(arg) && convertedScalar(arg, type) !== undefined) return true;
  return arg.type === type;
}

const isScalarConstant = (arg: Expression): arg is ConstantNode =>
  arg.kind === 'constant' && shapeOf(arg.type)?.lanes === 1;

/** A scalar constant as the row's type (`shader_language.cpp:3801`). */
function converted(arg: Expression, type: string): Expression {
  if (!isScalarConstant(arg) || arg.type === type) return arg;
  return { ...arg, type, values: [convertedScalar(arg, type)!] };
}
