/**
 * A call of a function of the shader, as Godot resolves it: the overload search at the call
 * (`shader_language.cpp:6213`), `_validate_function_call` with its messages (line 3870), and the
 * checks of each `const`, `out` and `inout` argument (line 6355).
 */

import { convertedScalar } from './constants.js';
import { instruction } from './instructions.js';
import { arraySizeOf, typeName } from './treeWalk.js';
import type { Argument, CallNode, Expression, ValueType } from './shaderTree.js';
import type { SourcePosition } from './shadingLanguageError.js';
import { shapeOf } from './types.js';

/** A function as a call sees it: its Godot name, its name in the text, its arguments and return type. */
export interface FunctionSignature {
  readonly name: string;
  readonly rname: string;
  readonly returnType: ValueType;
  /** The element count of an array return, 0 for one value. */
  readonly returnArraySize: number;
  readonly arguments: readonly Argument[];
}

/**
 * What a call needs of the parser: the functions of a name, the function whose body is read
 * (nothing outside a body), and the locals.
 */
export interface CallScope {
  functionsNamed(rname: string): readonly FunctionSignature[];
  currentFunction(): string | undefined;
  isLocal(name: string): boolean;
}

/**
 * The call of `rname` with `args`, read where `position` starts it. `fail` throws Godot's message
 * at the token after the arguments, where Godot reports it.
 */
export function resolvedCall(
  scope: CallScope,
  rname: string,
  args: readonly Expression[],
  position: SourcePosition,
  fail: (message: string) => never
): CallNode {
  if (scope.isLocal(rname)) fail('Expected a function name.');
  const candidates = scope.functionsNamed(rname);
  const convertsConstants = candidates.length === 1;
  const fitting = candidates.find((candidate) => fits(candidate, args, convertsConstants));
  const current = scope.currentFunction();
  if (current !== undefined && (fitting?.name ?? bestNamed(candidates, args, rname)) === current)
    fail('Recursion is not allowed.');
  if (!fitting) fail(mismatch(rname, candidates, args, convertsConstants));
  const operands = args.map((arg, index) => converted(arg, fitting.arguments[index]!.type));
  for (const [index, argument] of fitting.arguments.entries()) {
    const refusal = argumentRefusal(argument, operands[index]!);
    if (refusal !== undefined) fail(refusal);
  }
  return {
    kind: 'operator',
    op: 'OP_CALL',
    row: instruction('OP_CALL')!,
    function: fitting.name,
    rname: fitting.rname,
    qualifiers: fitting.arguments.map((argument) => argument.qualifier),
    type: fitting.returnType,
    ...(fitting.returnArraySize > 0 ? { arraySize: fitting.returnArraySize } : {}),
    operands,
    position,
  };
}

/** Whether `arg` is of `argument`'s type and size, or a scalar constant Godot converts to it. */
function isOfType(argument: Argument, arg: Expression, convertsConstants: boolean): boolean {
  if (arg.type === argument.type && arraySizeOf(arg) === (argument.arraySize ?? 0)) return true;
  return (
    convertsConstants &&
    arg.kind === 'constant' &&
    shapeOf(arg.type)?.lanes === 1 &&
    (argument.arraySize ?? 0) === 0 &&
    convertedScalar(arg, argument.type) !== undefined
  );
}

/**
 * The index of the first argument of `args` that `candidate` does not take, `args.length` when it
 * takes them all, and nothing for a candidate of another argument count.
 */
function firstMisfit(
  candidate: FunctionSignature,
  args: readonly Expression[],
  convertsConstants: boolean
): number | undefined {
  if (candidate.arguments.length !== args.length) return undefined;
  const index = candidate.arguments.findIndex(
    (argument, at) => !isOfType(argument, args[at]!, convertsConstants)
  );
  return index === -1 ? args.length : index;
}

const fits = (candidate: FunctionSignature, args: readonly Expression[], convertsConstants: boolean) =>
  firstMisfit(candidate, args, convertsConstants) === args.length;

/**
 * The name the call holds when no overload fits: the overload of the call's count with the most
 * arguments of the right type, or the name in the text. Godot checks recursion on it.
 */
function bestNamed(candidates: readonly FunctionSignature[], args: readonly Expression[], rname: string) {
  let name = rname;
  let most = 0;
  for (const candidate of candidates) {
    const valid = firstMisfit(candidate, args, false) ?? 0;
    if (valid > most) [name, most] = [candidate.name, valid];
  }
  return name;
}

/** Godot's message when no overload fits, in the order `_validate_function_call` sets them. */
function mismatch(
  rname: string,
  candidates: readonly FunctionSignature[],
  args: readonly Expression[],
  convertsConstants: boolean
): string {
  const failures = candidates.flatMap((candidate) => {
    const index = firstMisfit(candidate, args, convertsConstants);
    if (index === undefined) return [];
    const wanted = candidate.arguments[index]!;
    const given = args[index]!;
    return [
      {
        list: argumentList(candidate),
        index: index + 1,
        wanted: typeName(wanted.type, wanted.arraySize ?? 0),
        given: typeName(given.type, arraySizeOf(given)),
      },
    ];
  });
  const [only] = failures;
  if (only && failures.length === 1) {
    const { list, index, wanted, given } = only;
    return `No matching function for "${rname}(${list})" call: argument ${index} should be ${wanted} but is ${given}.`;
  }
  if (failures.length > 1) {
    const lines = failures.map(
      ({ list, index, wanted, given }) =>
        `\n\tcandidate function "${rname}(${list})" not viable, argument ${index} should be ${wanted} but is ${given}.`
    );
    return `No matching function for "${rname}" call:${lines.join('')}`;
  }
  const last = candidates.at(-1);
  const otherCount = [...candidates]
    .reverse()
    .find((candidate) => candidate.arguments.length !== args.length);
  if (!last || !otherCount) return `No matching function found for: '${rname}'.`;
  const [word, bound] = otherCount.arguments.length > args.length ? ['few', 'least'] : ['many', 'most'];
  return `Too ${word} arguments for "${rname}(${argumentList(last)})" call. Expected at ${bound} ${otherCount.arguments.length} but received ${args.length}.`;
}

/** The argument types of a function as Godot's messages list them: `float, Pair, int[2]`. */
const argumentList = (candidate: FunctionSignature) =>
  candidate.arguments.map((argument) => typeName(argument.type, argument.arraySize ?? 0)).join(', ');

/** `arg` as the argument's scalar type, where Godot converts a constant (`shader_language.cpp:3973`). */
function converted(arg: Expression, type: ValueType): Expression {
  if (arg.kind !== 'constant' || arg.type === type) return arg;
  return { ...arg, type, values: [convertedScalar(arg, type)!] };
}

/**
 * Godot's message for an argument that cannot take the place of a `const`, `out` or `inout`
 * parameter, or nothing when it can (`shader_language.cpp:6408`). A `const` parameter takes any
 * value. An `out` or `inout` parameter takes a variable, an array element or a member that is not
 * of a constant.
 */
function argumentRefusal(argument: Argument, arg: Expression): string | undefined {
  if (argument.qualifier === 'in') return undefined;
  return isConstantPlace(arg)
    ? `A constant value cannot be passed for the '${argument.qualifier}' parameter.`
    : undefined;
}

/** Whether `arg` is no place a call can write, as Godot reads the node: a value or a constant's part. */
function isConstantPlace(arg: Expression): boolean {
  switch (arg.kind) {
    case 'variable':
      return arg.isConst ?? false;
    case 'array element':
      return isConstantPlace(arg.array);
    case 'member':
    case 'field':
      return isConstantRoot(arg.owner);
    default:
      return true;
  }
}

/** Whether the variable a member reads is a constant: Godot's `basetype_const`. */
function isConstantRoot(owner: Expression): boolean {
  switch (owner.kind) {
    case 'variable':
      return owner.isConst ?? false;
    case 'member':
    case 'field':
      return isConstantRoot(owner.owner);
    case 'array element':
      return isConstantRoot(owner.array);
    default:
      return false;
  }
}
