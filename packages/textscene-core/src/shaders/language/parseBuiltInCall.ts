/**
 * A call of a built-in function, as `_validate_function_call` resolves it before the shader's own
 * functions (`shader_language.cpp:3622`): the first overload of `builtin_func_defs` whose
 * arguments fit, then the checks of each out argument (`builtin_func_out_args`, line 3543).
 */

import { convertedScalar } from './constants.js';
import { overloadInstructions } from './instructions.js';
import type { InstructionRow } from './instructionTable.generated.js';
import type { CallNode, Expression, Qualifier, ValueType } from './shaderTree.js';
import type { SourcePosition } from './shadingLanguageError.js';
import { arraySizeOf, typeName } from './treeWalk.js';
import { shapeOf } from './types.js';

/** The arguments each built-in writes, by index (`builtin_func_out_args`). */
const OUT_ARGUMENTS: Readonly<Record<string, readonly number[]>> = {
  modf: [1],
  umulExtended: [2, 3],
  imulExtended: [2, 3],
  uaddCarry: [2],
  usubBorrow: [2],
  ldexp: [1],
  frexp: [1],
};

/** A type name calls a constructor, which the parser reads apart from the functions. */
const isFunctionRow = (row: InstructionRow) =>
  row.family.startsWith('function') && !/^(?:[biu]?vec\d|mat\d|bool|int|uint|float)\(/.test(row.id);

/** The overloads of the built-in function `name`, in the order of `builtin_func_defs`. */
function godotOverloads(name: string): readonly InstructionRow[] {
  return overloadInstructions(name).filter(isFunctionRow);
}

/** Whether `arg` takes the place of an argument of `type`: the type, or a scalar constant Godot converts. */
function takes(type: string, arg: Expression): boolean {
  if (arraySizeOf(arg) > 0) return false;
  if (arg.type === type) return true;
  return (
    arg.kind === 'constant' && shapeOf(arg.type)?.lanes === 1 && convertedScalar(arg, type) !== undefined
  );
}

const fits = (row: InstructionRow, args: readonly Expression[]) =>
  row.args!.length === args.length && row.args!.every((type, index) => takes(type, args[index]!));

/** `arg` as `type`, where Godot converts a scalar constant (`shader_language.cpp:3815`). */
function converted(arg: Expression, type: ValueType): Expression {
  if (arg.kind !== 'constant' || arg.type === type) return arg;
  return { ...arg, type, values: [convertedScalar(arg, type)!] };
}

/** Godot's message for the out argument `arg` at `index` of `name`, or nothing when it is a place. */
function outRefusal(name: string, index: number, arg: Expression): string | undefined {
  if (
    arg.kind !== 'variable' &&
    arg.kind !== 'member' &&
    arg.kind !== 'field' &&
    arg.kind !== 'array element'
  )
    return `Argument ${index + 1} of function '${name}' is not a variable, array, or member.`;
  return isConstantPlace(arg) ? "A constant value cannot be passed for the 'out' parameter." : undefined;
}

/** Whether the variable a place reads is a constant: Godot's `is_const` and `basetype_const`. */
function isConstantPlace(place: Expression): boolean {
  switch (place.kind) {
    case 'variable':
      return place.isConst ?? false;
    case 'member':
    case 'field':
      return isConstantPlace(place.owner);
    case 'array element':
      return isConstantPlace(place.array);
    default:
      return false;
  }
}

/**
 * The call of the built-in `name` with `args`, or nothing when `name` names no built-in function.
 * `fail` throws Godot's message at the token after the arguments, where Godot reports it.
 */
export function resolvedBuiltInCall(
  name: string,
  args: readonly Expression[],
  position: SourcePosition,
  fail: (message: string) => never
): CallNode | undefined {
  const overloads = godotOverloads(name);
  if (overloads.length === 0) return undefined;
  const row = overloads.find((overload) => fits(overload, args));
  if (!row) {
    const given = args.map((arg) => typeName(arg.type, arraySizeOf(arg))).join(',');
    fail(`Invalid arguments for the built-in function: "${name}(${given})".`);
  }
  const outs = OUT_ARGUMENTS[name] ?? [];
  for (const index of outs.filter((at) => at < args.length)) {
    const refusal = outRefusal(name, index, args[index]!);
    if (refusal !== undefined) fail(refusal);
  }
  const qualifiers = args.map((_, index): Qualifier => (outs.includes(index) ? 'out' : 'in'));
  return {
    kind: 'operator',
    op: 'OP_CALL',
    row,
    function: name,
    rname: name,
    qualifiers,
    type: row.returns!,
    operands: args.map((arg, index) => converted(arg, row.args![index]!)),
    position,
  };
}
