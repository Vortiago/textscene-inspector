/**
 * The functions a shader's functions call, each as one GLSL function, as Godot's GLSL has them: a
 * TSL `Fn` with a layout for each function of the text and each overload. A call gives back its
 * result and the value of each `out` and `inout` parameter, as one value or as the members of one
 * struct, and the caller writes the parameters' values to its places, in order.
 */

import { Fn, int, property, struct } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { EmittedTree } from './emittedTree.js';
import {
  copyInto,
  inVar,
  leafTypes,
  leavesOf,
  type StructOf,
  type Value,
  valueOfLeaves,
  variablesOf,
  variablesWithLeaves,
} from './emitValue.js';
import type { Argument } from './shaderTree.js';

/** The value of a function's body, run with the values of its arguments by name. */
export type BodyEmitter = (tree: EmittedTree, names: ReadonlyMap<string, Value>) => Value | undefined;

export interface CallResult {
  /** The function's result, or the call node of a function that gives back nothing. */
  readonly result: Value;
  /** The value of each `out` and `inout` parameter after the call, in the order of the parameters. */
  readonly written: readonly Value[];
}

/** The GLSL functions of one shader, each built at its first call. */
export class CalledFunctions {
  /** Written only by `functionNamed`, at a function's first call. */
  private readonly built = new Map<string, GlslFunction>();

  constructor(
    private readonly trees: ReadonlyMap<string, EmittedTree>,
    private readonly structOf: StructOf,
    private readonly body: BodyEmitter
  ) {}

  /** The call of the function of Godot's name `name` in an expression, with a value for each argument but an `out` one. */
  call(name: string, args: readonly (Value | undefined)[]): CallResult {
    return this.functionNamed(name).call(args).called;
  }

  /**
   * The call as a statement. TSL drops the text of a call it builds as a statement, and of a
   * variable nothing reads, so a call that holds no variable is assigned to one of its own.
   */
  callAsStatement(name: string, args: readonly (Value | undefined)[]): CallResult {
    const { called, node, isHeld, type } = this.functionNamed(name).call(args);
    if (!isHeld) (property(type) as unknown as Node).assign(node);
    return called;
  }

  private functionNamed(name: string): GlslFunction {
    let built = this.built.get(name);
    if (built === undefined) {
      const tree = this.trees.get(name);
      if (tree === undefined) throw new Error(`expected a function ${name} in the shader`);
      built = new GlslFunction(tree, `sl${this.built.size}_${tree.lowered.rname}`, this.structOf, this.body);
      this.built.set(name, built);
    }
    return built;
  }
}

/** An argument of a function as GLSL passes it: its leaves, and whether the call writes it. */
interface Parameter {
  readonly argument: Argument;
  readonly leafCount: number;
  readonly isWritten: boolean;
}

/**
 * One function as GLSL. Its parameters are the leaves of each argument but an `out` one
 * (`leafTypes`). It gives back the leaves of its result, then of each `out` and `inout` parameter:
 * one value leaf as its return type, more or an array as the members of a struct, and none as an
 * int nothing reads.
 */
class GlslFunction {
  private readonly fn: (...leaves: Node[]) => Node;
  private readonly parameters: readonly Parameter[];
  private readonly resultCount: number;
  private readonly outputCount: number;
  /** The GLSL return type: a value type, `int` for no output, or the struct of the outputs. */
  private readonly type: string;
  /** Whether the function gives back a struct: for more than one leaf, or an array, which three's parser of GLSL cannot return. */
  private readonly isStruct: boolean;

  constructor(
    private readonly tree: EmittedTree,
    name: string,
    private readonly structOf: StructOf,
    body: BodyEmitter
  ) {
    const definition = tree.lowered;
    const typesOf = (argument: Argument) => leafTypes(argument.type, argument.arraySize ?? 0, structOf);
    this.parameters = definition.arguments.map((argument) => ({
      argument,
      leafCount: typesOf(argument).length,
      isWritten: argument.qualifier !== 'in',
    }));
    const inputTypes = definition.arguments
      .filter((argument) => argument.qualifier !== 'out')
      .flatMap(typesOf);
    const resultTypes =
      definition.returnType === 'void'
        ? []
        : leafTypes(definition.returnType, definition.returnArraySize ?? 0, structOf);
    const outputTypes = [
      ...resultTypes,
      ...definition.arguments.filter((argument) => argument.qualifier !== 'in').flatMap(typesOf),
    ];
    this.resultCount = resultTypes.length;
    this.outputCount = outputTypes.length;
    this.isStruct = outputTypes.length > 1 || outputTypes.some(isArrayType);
    const structName = `${name}_results`;
    const outputs = this.isStruct ? struct(membersOf(outputTypes), structName) : undefined;
    this.type = outputs ? structName : (outputTypes[0] ?? UNREAD_TYPE);
    // Two parameters, so TSL hands the inputs to a function of none too.
    const jsFunc = (inputs: Iterable<Node>, _builder: unknown) => {
      const leaves = this.output(body, [...inputs]);
      if (outputs) return outputs(...(leaves as never[]));
      return leaves[0] ?? int(0);
    };
    this.fn = Fn(jsFunc as never).setLayout({
      name,
      type: this.type,
      inputs: inputTypes.map((inputType, index) => ({ name: `p${index}`, type: inputType })),
    }) as unknown as (...leaves: Node[]) => Node;
  }

  /** The call, its node, and whether a variable holds the node where the call stands. */
  call(args: readonly (Value | undefined)[]): {
    called: CallResult;
    node: Node;
    isHeld: boolean;
    type: string;
  } {
    const leaves = this.parameters.flatMap(({ argument }, index) =>
      argument.qualifier === 'out'
        ? []
        : this.leavesOfValue(args[index]!, argument.type, argument.arraySize ?? 0)
    );
    const node = this.fn(...leaves);
    // A call that writes a place, or gives a struct, is held in a variable where it stands, so it
    // runs once and before any later read of the place.
    const isHeld = this.isStruct || this.outputCount > this.resultCount;
    const outputs = isHeld ? this.heldOutputs(inVar(node)) : [node];
    const definition = this.tree.lowered;
    const result =
      this.resultCount === 0
        ? node
        : valueOfLeaves(
            definition.returnType,
            definition.returnArraySize ?? 0,
            this.structOf,
            outputs.slice(0, this.resultCount)
          );
    const writtenParameters = this.parameters.filter((parameter) => parameter.isWritten);
    const written = splitLeaves(outputs.slice(this.resultCount), writtenParameters).map((parts, index) => {
      const { argument } = writtenParameters[index]!;
      return valueOfLeaves(argument.type, argument.arraySize ?? 0, this.structOf, parts);
    });
    return { called: { result, written }, node, isHeld, type: this.type };
  }

  private heldOutputs(held: Node): Node[] {
    if (!this.isStruct) return [held];
    const get = (held as unknown as { get(member: string): Node }).get.bind(held);
    return Array.from({ length: this.outputCount }, (_, index) => get(memberName(index)));
  }

  /** The body run with its parameters, and the leaves it gives back. */
  private output(body: BodyEmitter, inputs: readonly Node[]): Node[] {
    const names = new Map<string, Value>();
    const writtenLeaves: Node[] = [];
    const given = splitLeaves(
      inputs,
      this.parameters.filter(({ argument }) => argument.qualifier !== 'out')
    );
    let next = 0;
    for (const { argument } of this.parameters) {
      const size = argument.arraySize ?? 0;
      if (argument.qualifier === 'out') {
        const variables = variablesWithLeaves(argument.type, size, this.structOf);
        names.set(argument.name, variables.value);
        writtenLeaves.push(...variables.leaves);
        continue;
      }
      const value = valueOfLeaves(argument.type, size, this.structOf, given[next++]!);
      names.set(argument.name, this.parameterValue(argument, value, writtenLeaves));
    }
    const result = body(this.tree, names);
    const definition = this.tree.lowered;
    const resultLeaves =
      result === undefined
        ? []
        : this.leavesOfValue(result, definition.returnType, definition.returnArraySize ?? 0);
    return [...resultLeaves, ...writtenLeaves];
  }

  /**
   * The value an `in` or `inout` parameter holds in the body. An `inout` one gets new variables,
   * and an `in` one as `parameterValue` gives it.
   */
  private parameterValue(argument: Argument, given: Value, writtenLeaves: Node[]): Value {
    if (argument.qualifier !== 'inout')
      return parameterValue(argument, given, this.tree.written, this.structOf);
    const variables = variablesWithLeaves(argument.type, argument.arraySize ?? 0, this.structOf);
    copyInto(variables.value, given);
    writtenLeaves.push(...variables.leaves);
    return variables.value;
  }

  /** The leaves of a value: the value itself, or a copy of its parts. */
  private leavesOfValue(value: Value, type: string, arraySize: number): Node[] {
    if (arraySize === 0 && !this.structOf(type)) return [value as Node];
    return leavesOf(value, type, arraySize, this.structOf);
  }
}

/**
 * The value an `in` parameter holds in a function's body. An argument the function never writes
 * is read from its node, as Godot's GLSL reads its parameter. A copy into a `Var` lets the driver
 * fold the arithmetic otherwise, one unit apart.
 */
export function parameterValue(
  argument: Argument,
  given: Value,
  written: ReadonlySet<string>,
  structOf: StructOf
): Value {
  return written.has(argument.name)
    ? variablesOf(given, argument.type, argument.arraySize ?? 0, structOf)
    : given;
}

/** `leaves` cut into the leaves of each of `parameters`, in order. */
function splitLeaves(leaves: readonly Node[], parameters: readonly Parameter[]): Node[][] {
  let next = 0;
  return parameters.map(({ leafCount }) => leaves.slice(next, (next += leafCount)));
}

/** The return type of a function that gives back nothing: TSL drops the text of a `void` call. */
const UNREAD_TYPE = 'int';

const memberName = (index: number) => `m${index}`;

const isArrayType = (type: string) => type.endsWith(']');

const membersOf = (types: readonly string[]) =>
  Object.fromEntries(types.map((type, index) => [memberName(index), type]));
