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
import type { Argument, ShaderNode, ValueType } from './shaderTree.js';

/**
 * A function of the shader as TSL. `call` builds a `Fn` from one node per argument: a value
 * function gives the node of its result, and a `void` function gives the call node, which the
 * caller puts on its own stack.
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
