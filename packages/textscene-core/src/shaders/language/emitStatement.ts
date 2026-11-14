/**
 * The statements of a function's lowered tree as TSL, a plain walk. Each statement becomes the
 * TSL statement of the same GLSL statement, in order on TSL's stack, so the GPU runs what Godot's
 * GLSL runs. The tree it reads holds `while (true)` as its one loop, no `switch`, and one `return`
 * as its last statement (`lowering/lower.ts`).
 */

import { Break, Continue, Discard, If, Loop } from 'three/tsl';
import type { EmitScope } from './emitScope.js';
import { type EmitContext, ExpressionEmitter } from './emitExpression.js';
import { declareVariables, type Value, variablesOf } from './emitValue.js';
import type { GlslangFolding } from './glslangFolding.js';
import type {
  BlockNode,
  ControlFlowNode,
  DeclarationNode,
  Declarator,
  Expression,
  Statement,
  ValueType,
} from './shaderTree.js';
import { isCall, isEmpty, isReturn } from './treeWalk.js';

export class StatementEmitter {
  constructor(
    private readonly folding: GlslangFolding,
    private readonly context: EmitContext
  ) {}

  /** The body's statements, and the value of its last statement's `return`, if it has one. */
  body(body: BlockNode, scope: EmitScope): Value | undefined {
    const statements = body.statements;
    const last = statements.at(-1);
    const endsInReturn = last !== undefined && isReturn(last);
    for (const statement of endsInReturn ? statements.slice(0, -1) : statements)
      this.statement(statement, scope);
    const value = endsInReturn ? last.expressions[0] : undefined;
    return value && this.expressions(scope).value(value);
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
      case 'slot':
        throw new Error(`expected the material's ${statement.name} code in the slot, found an empty slot`);
      default:
        if (isCall(statement)) this.expressions(scope).callStatement(statement);
        else if (!isEmpty(statement)) this.expressions(scope).value(statement);
    }
  }

  /** Each name's variables, which take its value, then the name. A value reads no name it declares. */
  private declaration(declaration: DeclarationNode, scope: EmitScope): void {
    for (const declarator of declaration.declarators)
      scope.declare(declarator.name, this.declared(declaration.type, declarator, scope));
  }

  /** The variables of one name: new ones, or the ones a constructor of its value built already. */
  private declared(type: ValueType, declarator: Declarator, scope: EmitScope): Value {
    const arraySize = declarator.arraySize ?? 0;
    const { value } = declarator;
    if (value === undefined) return declareVariables(type, arraySize, this.context.structOf);
    const built = this.expressions(scope).value(value);
    return buildsVariables(value) ? built : variablesOf(built, type, arraySize, this.context.structOf);
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
    return new ExpressionEmitter(scope, this.folding, this.context);
  }
}

/** Whether `value` gives new variables that nothing else reads: an array or a struct constructor. */
const buildsVariables = (value: Expression) =>
  value.kind === 'array construct' || (value.kind === 'operator' && value.op === 'OP_STRUCT');
