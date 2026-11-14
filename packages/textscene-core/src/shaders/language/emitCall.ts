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
import type { Argument, FunctionNode } from './shaderTree.js';

/** The value of a function's body, run with the values of its arguments by name. */
export type BodyEmitter = (tree: EmittedTree, names: ReadonlyMap<string, Value>) => Value | undefined;

export interface CallResult {
  /** The function's result, or the variable a `void` function's call is assigned to. */
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

  /** The call of the function of Godot's name `name`, with a value for each argument but an `out` one. */
  call(name: string, args: readonly (Value | undefined)[]): CallResult {
    return this.functionNamed(name).call(args);
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

/**
 * One function as GLSL. Its parameters are the leaves of each argument but an `out` one
 * (`leafTypes`). It gives back the leaves of its result, then of each `out` and `inout` parameter:
 * one value leaf as its return type, more or an array as the members of a struct, and none as an
 * int nothing reads.
 */
class GlslFunction {
  private readonly fn: (...leaves: Node[]) => Node;
  private readonly outputCount: number;
  private readonly resultCount: number;
  /** Whether the function gives back a struct: for more than one leaf, or an array, which three's parser of GLSL cannot return. */
  private readonly isStruct: boolean;

  constructor(
    private readonly tree: EmittedTree,
    name: string,
    private readonly structOf: StructOf,
    body: BodyEmitter
  ) {
    const definition = tree.lowered;
    const inputTypes = definition.arguments
      .filter((argument) => argument.qualifier !== 'out')
      .flatMap((argument) => this.leafTypesOf(argument));
    const resultTypes =
      definition.returnType === 'void'
        ? []
        : leafTypes(definition.returnType, definition.returnArraySize ?? 0, structOf);
    const outputTypes = [
      ...resultTypes,
      ...writtenArguments(definition).flatMap((argument) => this.leafTypesOf(argument)),
    ];
    this.resultCount = resultTypes.length;
    this.outputCount = outputTypes.length;
    this.isStruct = outputTypes.length > 1 || outputTypes.some(isArrayType);
    const outputs = this.isStruct ? struct(membersOf(outputTypes), `${name}_results`) : undefined;
    const type = outputs ? `${name}_results` : (outputTypes[0] ?? UNREAD_TYPE);
    // Two parameters, so TSL hands the inputs to a function of none too.
    const jsFunc = (inputs: Iterable<Node>, _builder: unknown) => {
      const leaves = this.output(body, [...inputs]);
      if (outputs) return outputs(...(leaves as never[]));
      return leaves[0] ?? int(0);
    };
    this.fn = Fn(jsFunc as never).setLayout({
      name,
      type,
      inputs: inputTypes.map((inputType, index) => ({ name: `p${index}`, type: inputType })),
    }) as unknown as (...leaves: Node[]) => Node;
  }

  call(args: readonly (Value | undefined)[]): CallResult {
    const definition = this.tree.lowered;
    const leaves = definition.arguments.flatMap((argument, index) =>
      argument.qualifier === 'out'
        ? []
        : this.leavesOfValue(args[index]!, argument.type, argument.arraySize ?? 0)
    );
    const node = this.fn(...leaves);
    if (this.outputCount === 0) return { result: asStatement(node), written: [] };
    const outputs = this.outputsOf(node);
    const result =
      this.resultCount === 0
        ? node
        : valueOfLeaves(
            definition.returnType,
            definition.returnArraySize ?? 0,
            this.structOf,
            outputs.slice(0, this.resultCount)
          );
    let next = this.resultCount;
    const written = writtenArguments(definition).map((argument) => {
      const count = this.leafTypesOf(argument).length;
      next += count;
      return valueOfLeaves(
        argument.type,
        argument.arraySize ?? 0,
        this.structOf,
        outputs.slice(next - count, next)
      );
    });
    return { result, written };
  }

  /**
   * The leaves of what a call gives back. A call that writes a place, or gives a struct, is held
   * in a variable where it stands, so it runs once and before any later read of the place.
   */
  private outputsOf(node: Node): Node[] {
    const isHeld = this.isStruct || this.outputCount > this.resultCount;
    if (!isHeld) return [node];
    const held = inVar(node);
    if (!this.isStruct) return [held];
    const get = (held as unknown as { get(member: string): Node }).get.bind(held);
    return Array.from({ length: this.outputCount }, (_, index) => get(memberName(index)));
  }

  /** The body run with its parameters, and the leaves it gives back. */
  private output(body: BodyEmitter, parameters: readonly Node[]): Node[] {
    const names = new Map<string, Value>();
    const writtenLeaves: Node[] = [];
    let next = 0;
    for (const argument of this.tree.lowered.arguments) {
      const size = argument.arraySize ?? 0;
      if (argument.qualifier === 'out') {
        const variables = variablesWithLeaves(argument.type, size, this.structOf);
        names.set(argument.name, variables.value);
        writtenLeaves.push(...variables.leaves);
        continue;
      }
      const count = this.leafTypesOf(argument).length;
      const given = valueOfLeaves(argument.type, size, this.structOf, parameters.slice(next, next + count));
      next += count;
      names.set(argument.name, this.parameterValue(argument, given, writtenLeaves));
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
   * The value an `in` or `inout` parameter holds in the body. An `inout` one and a written `in`
   * one get new variables. An `in` one the body never writes is read from its parameter.
   */
  private parameterValue(argument: Argument, given: Value, writtenLeaves: Node[]): Value {
    const size = argument.arraySize ?? 0;
    if (argument.qualifier === 'inout') {
      const variables = variablesWithLeaves(argument.type, size, this.structOf);
      copyInto(variables.value, given);
      writtenLeaves.push(...variables.leaves);
      return variables.value;
    }
    return this.tree.written.has(argument.name)
      ? variablesOf(given, argument.type, size, this.structOf)
      : given;
  }

  /** The leaves of a value: the value itself, or a copy of its parts. */
  private leavesOfValue(value: Value, type: string, arraySize: number): Node[] {
    if (arraySize === 0 && !this.structOf(type)) return [value as Node];
    return leavesOf(value, type, arraySize, this.structOf);
  }

  private leafTypesOf(argument: Argument): string[] {
    return leafTypes(argument.type, argument.arraySize ?? 0, this.structOf);
  }
}

/**
 * The return type of a function that gives back nothing. TSL drops the text of a call of a `void`
 * function that it builds as a statement, and of a variable nothing reads. So the function gives
 * an int, which the call assigns to a variable of its own.
 */
const UNREAD_TYPE = 'int';

const asStatement = (call: Node): Node => {
  const sink = property(UNREAD_TYPE) as unknown as Node;
  sink.assign(call);
  return sink;
};

const writtenArguments = (definition: FunctionNode) =>
  definition.arguments.filter((argument) => argument.qualifier !== 'in');

const memberName = (index: number) => `m${index}`;

const isArrayType = (type: string) => type.endsWith(']');

const membersOf = (types: readonly string[]) =>
  Object.fromEntries(types.map((type, index) => [memberName(index), type]));
