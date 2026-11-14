/**
 * The emitter: a shader's lowered functions to three.js TSL. A function the caller of the
 * transpiler calls is built where it is called, from one node per argument. A function the shader
 * calls is one GLSL function, as in Godot's GLSL (`emitCall.ts`).
 */

import { Fn } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { type BodyEmitter, CalledFunctions, parameterValue } from './emitCall.js';
import type { EmitContext } from './emitExpression.js';
import { EmitScope } from './emitScope.js';
import { StatementEmitter } from './emitStatement.js';
import { emittedTree, type EmittedTree } from './emittedTree.js';
import type { StructOf, Value } from './emitValue.js';
import type { Argument, FunctionNode, ShaderNode, ValueType } from './shaderTree.js';
import { typeName } from './treeWalk.js';
import { shapeOf } from './types.js';

/**
 * A function of the shader as TSL. `call` builds a `Fn` from one node per argument: a value
 * function gives the node of its result, and a `void` function gives the call node, which the
 * caller puts on its own stack. It throws for a function whose argument or result is no one node:
 * a struct, an array, or an `out` or `inout` argument.
 */
export interface TranspiledFunction {
  readonly name: string;
  /** A value type, or `void`. */
  readonly returnType: ValueType;
  readonly arguments: readonly Argument[];
  call(args: readonly Node[]): Node;
}

/** Each function of `shader` as TSL, by Godot's name. The tree holds only transpiled rows (`checkTranspiled`). */
export function emitShader(shader: ShaderNode): ReadonlyMap<string, TranspiledFunction> {
  const structs = new Map(shader.structs.map((struct) => [struct.name, struct]));
  const structOf: StructOf = (type) => structs.get(type);
  const trees = new Map(shader.functions.map((definition) => [definition.name, emittedTree(definition)]));
  const body: BodyEmitter = (tree, names) =>
    new StatementEmitter(tree.folding, context).body(tree.lowered.body, EmitScope.of(names));
  const context: EmitContext = { structOf, functions: new CalledFunctions(trees, structOf, body) };
  return new Map([...trees].map(([name, tree]) => [name, calledInPlace(tree, body, structOf)]));
}

function calledInPlace(tree: EmittedTree, body: BodyEmitter, structOf: StructOf): TranspiledFunction {
  const definition = tree.lowered;
  return {
    name: definition.name,
    returnType: definition.returnType,
    arguments: definition.arguments,
    call(args) {
      if (args.length !== definition.arguments.length) {
        throw new Error(
          `expected ${definition.arguments.length} arguments for ${definition.name}, got ${args.length}`
        );
      }
      const misfit = misfitForOneNode(definition);
      if (misfit !== undefined)
        throw new Error(`expected ${definition.name} to take and give one node each, but ${misfit}`);
      return Fn(() => {
        const names = new Map<string, Value>(
          definition.arguments.map((argument, index) => [
            argument.name,
            parameterValue(argument, args[index]!, tree.written, structOf),
          ])
        );
        return body(tree, names);
      })() as unknown as Node;
    },
  };
}

/**
 * Why `definition` cannot be called with one node per argument and give one node back, or
 * nothing: a struct or an array, or an argument the call writes, has no such node.
 */
function misfitForOneNode(definition: FunctionNode): string | undefined {
  const argument = definition.arguments.find(
    (candidate) => candidate.qualifier !== 'in' || !isOneValue(candidate.type, candidate.arraySize ?? 0)
  );
  if (argument)
    return `its argument ${argument.name} is ${argument.qualifier} ${typeName(argument.type, argument.arraySize ?? 0)}`;
  const { returnType, returnArraySize = 0 } = definition;
  if (returnType !== 'void' && !isOneValue(returnType, returnArraySize))
    return `it returns ${typeName(returnType, returnArraySize)}`;
  return undefined;
}

const isOneValue = (type: ValueType, arraySize: number) => arraySize === 0 && shapeOf(type) !== undefined;
