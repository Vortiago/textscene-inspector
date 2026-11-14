/**
 * The emitter: a shader's lowered functions to three.js TSL. A function the caller of the
 * transpiler calls is built where it is called, from one node per argument. A function the shader
 * calls is one GLSL function, as in Godot's GLSL (`emitCall.ts`).
 */

import { Fn } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { type BodyEmitter, CalledFunctions } from './emitCall.js';
import type { EmitContext } from './emitExpression.js';
import { EmitScope } from './emitScope.js';
import { StatementEmitter } from './emitStatement.js';
import { emittedTree, type EmittedTree } from './emittedTree.js';
import { inVar, type StructOf, type Value } from './emitValue.js';
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
  const structOf: StructOf = (type) => shader.structs.find((struct) => struct.name === type);
  const trees = new Map(shader.functions.map((definition) => [definition.name, emittedTree(definition)]));
  const body: BodyEmitter = (tree, names) =>
    new StatementEmitter(tree.folding, context).body(tree.lowered.body, EmitScope.of(names));
  const context: EmitContext = { structOf, functions: new CalledFunctions(trees, structOf, body) };
  return new Map([...trees].map(([name, tree]) => [name, calledInPlace(tree, body)]));
}

function calledInPlace(tree: EmittedTree, body: BodyEmitter): TranspiledFunction {
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
        // An argument the function never writes is read from its node, as Godot's GLSL reads its
        // parameter. A copy into a `Var` lets the driver fold the arithmetic otherwise, one unit apart.
        const names = new Map<string, Value>(
          definition.arguments.map((argument, index) => [
            argument.name,
            tree.written.has(argument.name) ? inVar(args[index]!) : args[index]!,
          ])
        );
        return body(tree, names);
      })() as unknown as Node;
    },
  };
}
