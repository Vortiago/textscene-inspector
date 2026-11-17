import { Fn, int, property, struct } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { EmittedTree } from './emittedTree.js';
import { isSamplerType } from './types.js';
import { isArrayType, wholeArrays } from './wholeArray.js';
import {
  copyInto,
  inVar,
  isArrayValue,
  leafTypes,
  leavesOf,
  type StructOf,
  type Value,
  valueOfLeaves,
  variablesOf,
  variablesWithLeaves,
} from './emitValue.js';
import type { Argument } from './shaderTree.js';
import { SamplerChoice } from './textureCalls.js';

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
  /** Written only by `functionNamed`, at a function's first call with each set of textures. */
  private readonly built = new Map<string, GlslFunction>();

  constructor(
    private readonly trees: ReadonlyMap<string, EmittedTree>,
    private readonly structOf: StructOf,
    private readonly body: BodyEmitter
  ) {}

  /** With a value for each argument but an `out` one. */
  call(name: string, args: readonly (Value | undefined)[]): CallResult {
    return this.functionNamed(name, args).call(args).called;
  }

  /** TSL drops a statement call and an unread variable, so an unread call gets a variable of its own. */
  callAsStatement(name: string, args: readonly (Value | undefined)[]): CallResult {
    const { called, node, isHeld, type } = this.functionNamed(name, args).call(args);
    if (!isHeld || called.written.length === 0) (property(type) as unknown as Node).assign(node);
    return called;
  }

  /** A GLSL function per set of textures its sampler arguments read: a TSL function takes no sampler. */
  private functionNamed(name: string, args: readonly (Value | undefined)[]): GlslFunction {
    const tree = this.trees.get(name);
    if (tree === undefined) throw new Error(`expected a function ${name} in the shader`);
    const samplers = samplerArguments(tree.lowered.arguments, args);
    const key = [name, ...[...samplers.values()].map(samplerKey)].join(' ');
    let built = this.built.get(key);
    if (built === undefined) {
      const glslName = `sl${this.built.size}_${tree.lowered.rname}`;
      built = new GlslFunction(tree, glslName, this.structOf, this.body, samplers);
      this.built.set(key, built);
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

/** Gives back result leaves, then each `out` and `inout` leaf: one leaf as the return, more as a struct. */
class GlslFunction {
  private readonly fn: (...leaves: Node[]) => Node;
  private readonly parameters: readonly Parameter[];
  private readonly resultCount: number;
  private readonly outputCount: number;
  /** The GLSL return type: a value type, `int` for no output, or the struct of the outputs. */
  private readonly type: string;
  /** Three's GLSL parser cannot return an array, so more than one leaf or an array is a struct. */
  private readonly isStruct: boolean;

  constructor(
    private readonly tree: EmittedTree,
    name: string,
    private readonly structOf: StructOf,
    body: BodyEmitter,
    private readonly samplers: ReadonlyMap<string, Value>
  ) {
    const definition = tree.lowered;
    const typesOf = (argument: Argument) =>
      isSamplerType(argument.type) ? [] : leafTypes(argument.type, argument.arraySize ?? 0, structOf);
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
      const leaves = this.output(body, wholeArrays([...inputs], inputTypes));
      if (outputs) return outputs(...(wholeArrays(leaves, outputTypes) as never[]));
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
      argument.qualifier === 'out' || isSamplerType(argument.type)
        ? []
        : this.leavesOfValue(args[index]!, argument.type, argument.arraySize ?? 0)
    );
    const node = this.fn(...leaves);
    // Held where it stands, so it runs once and before any later read of the place.
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
      const leaves = given[next++]!;
      if (isSamplerType(argument.type)) {
        names.set(argument.name, this.samplers.get(argument.name)!);
        continue;
      }
      const value = valueOfLeaves(argument.type, size, this.structOf, leaves);
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

  /** An `inout` parameter gets new variables, and an `in` one the value `parameterValue` gives. */
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

/** An unwritten argument is read from its node, as Godot reads its parameter: a `Var` would fold apart. */
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

/** The value each sampler argument is given, by name. */
function samplerArguments(
  parameters: readonly Argument[],
  args: readonly (Value | undefined)[]
): ReadonlyMap<string, Value> {
  return new Map(
    parameters.flatMap((argument, index) =>
      isSamplerType(argument.type) ? [[argument.name, args[index]!] as const] : []
    )
  );
}

/** The ids of the texture nodes a sampler value holds: one, one per array element, or a choice by index. */
function samplerKey(value: Value): string {
  if (value instanceof SamplerChoice)
    return `${value.elements.map((element) => element.id).join('|')}@${value.index.id}`;
  if (!isArrayValue(value)) return String((value as Node).id);
  return Array.from({ length: value.count }, (_, index) => samplerKey(value.element(index))).join(',');
}

/** `leaves` cut into the leaves of each of `parameters`, in order. */
function splitLeaves(leaves: readonly Node[], parameters: readonly Parameter[]): Node[][] {
  let next = 0;
  return parameters.map(({ leafCount }) => leaves.slice(next, (next += leafCount)));
}

/** The return type of a function that gives back nothing: TSL drops the text of a `void` call. */
const UNREAD_TYPE = 'int';

const memberName = (index: number) => `m${index}`;

const membersOf = (types: readonly string[]) =>
  Object.fromEntries(types.map((type, index) => [memberName(index), type]));
