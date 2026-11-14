/**
 * The emitter: a function's lowered tree to a three.js TSL `Fn`, a plain walk. Each statement
 * becomes the TSL statement of the same GLSL statement, in order on TSL's stack, so the GPU runs
 * what Godot's GLSL runs. The tree it reads holds `while (true)` as its one loop, no `switch`, and
 * one `return` as its last statement (`lowering/lower.ts`).
 */

import { Break, Continue, Discard, Fn, If, Loop } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { bindConstantReads } from './constantReads.js';
import { EmitScope } from './emitScope.js';
import { ExpressionEmitter, writtenNames } from './emitExpression.js';
import { declareVariables, inVar, type StructOf, type Value, variablesOf } from './emitValue.js';
import { refuseFoldedIndexOutOfRange } from './foldedIndex.js';
import { GlslangFolding } from './glslangFolding.js';
import { glslBlock } from './godotText.js';
import { lowerFunction } from './lowering/lower.js';
import type {
  Argument,
  BlockNode,
  ControlFlowNode,
  DeclarationNode,
  FunctionNode,
  ShaderNode,
  Statement,
  ValueType,
} from './shaderTree.js';
import { isEmpty, isReturn } from './treeWalk.js';

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

/** `definition` of `shader` as TSL. The tree holds only rows the transpiler transpiles (`checkTranspiled`). */
export function emitFunction(definition: FunctionNode, shader: ShaderNode): TranspiledFunction {
  const folding = new GlslangFolding();
  const glsl = { ...definition, body: glslBlock(definition.body) };
  bindConstantReads(glsl.body, folding);
  refuseFoldedIndexOutOfRange(glsl.body, folding);
  const lowered = lowerFunction(glsl);
  const structOf: StructOf = (type) => shader.structs.find((struct) => struct.name === type);
  // An argument the function never writes is read from its node, as Godot's GLSL reads its
  // parameter. A copy into a `Var` lets the driver fold the arithmetic otherwise, one unit apart.
  const written = writtenNames(lowered.body);
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
            written.has(argument.name) ? inVar(args[index]!) : args[index]!,
          ])
        );
        return new StatementEmitter(folding, structOf).body(lowered.body, EmitScope.of(names));
      })() as unknown as Node;
    },
  };
}

class StatementEmitter {
  constructor(
    private readonly folding: GlslangFolding,
    private readonly structOf: StructOf
  ) {}

  /** The body's statements, and the node of its last statement's `return`, if it has one. */
  body(body: BlockNode, scope: EmitScope): Node | undefined {
    const statements = body.statements;
    const last = statements.at(-1);
    const endsInReturn = last !== undefined && isReturn(last);
    for (const statement of endsInReturn ? statements.slice(0, -1) : statements)
      this.statement(statement, scope);
    const value = endsInReturn ? last.expressions[0] : undefined;
    return value && this.expressions(scope).node(value);
  }

  private block(block: BlockNode, scope: EmitScope): void {
    for (const statement of block.statements) this.statement(statement, scope);
  }

  private statement(statement: Statement, scope: EmitScope): void {
    switch (statement.kind) {
      case 'block':
        return this.block(statement, scope.child());
      case 'declaration':
        return this.declaration(statement, scope);
      case 'control flow':
        return this.flow(statement, scope);
      default:
        if (!isEmpty(statement)) this.expressions(scope).value(statement);
    }
  }

  /** Each name's variables, which take its value, then the name. A value reads no name it declares. */
  private declaration(declaration: DeclarationNode, scope: EmitScope): void {
    for (const declarator of declaration.declarators) {
      const arraySize = declarator.arraySize ?? 0;
      const value = declarator.value && this.expressions(scope).value(declarator.value);
      const variables =
        value === undefined
          ? declareVariables(declaration.type, arraySize, this.structOf)
          : variablesOf(value, declaration.type, arraySize, this.structOf);
      scope.declare(declarator.name, variables);
    }
  }

  private flow(flow: ControlFlowNode, scope: EmitScope): void {
    switch (flow.flow) {
      case 'FLOW_OP_IF':
        return this.ifStatement(flow, scope);
      case 'FLOW_OP_WHILE':
        Loop(this.inBlock(flow.blocks[0]!, scope) as never);
        return;
      case 'FLOW_OP_BREAK':
        Break();
        return;
      case 'FLOW_OP_CONTINUE':
        Continue();
        return;
      case 'FLOW_OP_DISCARD':
        Discard();
        return;
      default:
        throw new Error(`expected a lowered tree, got ${flow.flow} where the lowerings leave none`);
    }
  }

  private ifStatement(flow: ControlFlowNode, scope: EmitScope): void {
    const [then, otherwise] = flow.blocks;
    const test = this.expressions(scope).node(flow.expressions[0]!);
    const branch = If(test as never, this.inBlock(then!, scope) as never) as unknown as {
      Else(method: () => void): unknown;
    };
    if (otherwise) branch.Else(this.inBlock(otherwise, scope));
  }

  /** The statements of `block` as a TSL body, which TSL builds later, in a copy of the scope here. */
  private inBlock(block: BlockNode, scope: EmitScope): () => void {
    const here = scope.child();
    return () => this.block(block, here.child());
  }

  private expressions(scope: EmitScope): ExpressionEmitter {
    return new ExpressionEmitter(scope, this.folding, this.structOf);
  }
}
