/**
 * The lowering of side effects, the last one: each write that GLSL orders inside an expression
 * becomes the order of statements. A value read before a part that writes is kept in a variable
 * declared first, so `a + (a = 3.0)` reads `a` before the write. `c ? a : b`, `a && b` and
 * `a || b` with a side that writes become an `if`, as GLSL runs one side. An index that writes,
 * in a place that is written, is kept, so `a[i++] += 1.0` steps `i` once.
 */

import { isWriteOperator, writes } from '../assignment.js';
import { arraySizeOf } from '../parseExpression.js';
import type {
  DeclarationNode,
  Expression,
  FunctionNode,
  OperatorNode,
  Statement,
  VariableNode,
} from '../shaderTree.js';
import { subExpressions, withSubExpressions } from '../treeWalk.js';
import { shapeOf } from '../types.js';
import type { FreshNames } from './freshNames.js';
import { assign, declaration, flow, flowBody, ifStatement, not, variable } from './nodes.js';
import { rewriteFunction } from './rewrite.js';

export function lowerSideEffects(definition: FunctionNode, names: FreshNames): FunctionNode {
  return rewriteFunction(definition, (statement) => new Hoist(names).statement(statement));
}

/** The statements one statement's writes become, gathered in GLSL's order of evaluation. */
class Hoist {
  private readonly statements: Statement[] = [];

  constructor(private readonly names: FreshNames) {}

  /** `statement` after the statements its writes need, or `statement` alone when nothing moves. */
  statement(statement: Statement): Statement | readonly Statement[] {
    switch (statement.kind) {
      case 'block':
        return statement;
      case 'declaration':
        return this.declaration(statement);
      case 'control flow':
        return this.done({
          ...statement,
          expressions: statement.expressions.map((part) => this.expression(part)),
        });
      default:
        return this.done(this.expression(statement));
    }
  }

  private done(statement: Statement): Statement | readonly Statement[] {
    return this.statements.length === 0 ? statement : [...this.statements, statement];
  }

  /** One declaration for each name, so a value that writes runs after the names before it. */
  private declaration(declaration: DeclarationNode): Statement | readonly Statement[] {
    if (!declaration.declarators.some((declarator) => declarator.value && writes(declarator.value)))
      return declaration;
    for (const declarator of declaration.declarators) {
      const value = declarator.value && this.expression(declarator.value);
      this.statements.push({ ...declaration, declarators: [{ ...declarator, ...(value ? { value } : {}) }] });
    }
    return this.statements;
  }

  /** `expression` with each write it holds ordered by the statements gathered before it. */
  private expression(expression: Expression): Expression {
    if (!writes(expression)) return expression;
    if (expression.kind === 'whole assign')
      return {
        ...expression,
        target: this.place(expression.target),
        value: this.expression(expression.value),
      };
    if (expression.kind !== 'operator') return this.inOrder(expression);
    const { op } = expression;
    if (op === 'OP_SELECT_IF') return this.selected(expression);
    if (op === 'OP_AND' || op === 'OP_OR') return this.shortCircuit(expression);
    if (isWriteOperator(op)) return this.assigned(expression);
    return this.inOrder(expression);
  }

  /** Each part in order. Before a part that writes, the values read so far are kept. */
  private inOrder(expression: Expression): Expression {
    const parts: Expression[] = [];
    let keptBefore = 0;
    for (const part of subExpressions(expression)) {
      if (writes(part)) {
        for (let index = keptBefore; index < parts.length; index++) parts[index] = this.kept(parts[index]!);
        keptBefore = parts.length;
      }
      parts.push(this.expression(part));
    }
    return rebuilt(expression, parts);
  }

  /** `a = b`, `a op= b` and the steps: the place's indices that write first, then `b`. */
  private assigned(expression: OperatorNode): Expression {
    const [target, ...rest] = expression.operands as [Expression, ...Expression[]];
    const place = this.place(target);
    return { ...expression, operands: [place, ...rest.map((part) => this.expression(part))] };
  }

  /** `target` with each index that writes kept, outermost value first. */
  private place(target: Expression): Expression {
    if (target.kind === 'array element')
      return { ...target, array: this.place(target.array), index: this.keptIfWriting(target.index) };
    if (target.kind === 'operator' && target.op === 'OP_INDEX') {
      const [owner, index] = target.operands as [Expression, Expression];
      return { ...target, operands: [this.place(owner), this.keptIfWriting(index)] };
    }
    if (target.kind === 'member' || target.kind === 'field')
      return { ...target, owner: this.place(target.owner) };
    return target;
  }

  private keptIfWriting(index: Expression): Expression {
    return writes(index) ? this.kept(this.expression(index)) : index;
  }

  /** `c ? a : b` with a side that writes: `T t; if (c) t = a; else t = b;`. */
  private selected(expression: OperatorNode): Expression {
    const [condition, then, otherwise] = expression.operands as [Expression, Expression, Expression];
    const test = this.expression(condition);
    if (!writes(then) && !writes(otherwise)) return { ...expression, operands: [test, then, otherwise] };
    const result = this.declared(expression, undefined);
    const branch = (part: Expression) => flowBody(this.assignedIn(result, part), part.position);
    this.statements.push(flow('FLOW_OP_IF', [test], [branch(then), branch(otherwise)], expression.position));
    return result;
  }

  /** `a && b` or `a || b` with `b` writing: `bool t = a; if (t) t = b;`, or `if (!t)` for `||`. */
  private shortCircuit(expression: OperatorNode): Expression {
    const [first, second] = expression.operands as [Expression, Expression];
    const test = this.expression(first);
    if (!writes(second)) return { ...expression, operands: [test, second] };
    const result = this.declared(expression, test);
    const runsSecond = expression.op === 'OP_AND' ? result : not(result);
    this.statements.push(ifStatement(runsSecond, this.assignedIn(result, second), expression.position));
    return result;
  }

  /** The statements that write `part` into `result`, its own writes ordered first. */
  private assignedIn(result: VariableNode, part: Expression): Statement[] {
    const inner = new Hoist(this.names);
    const value = inner.expression(part);
    return [...inner.statements, write(result, value)];
  }

  /** `value` kept in a variable declared now, or `value` itself when no write can change it. */
  private kept(value: Expression): Expression {
    return value.kind === 'constant' ? value : this.declared(value, value);
  }

  /** A fresh variable of `expression`'s type, declared now with `value`, or with none. */
  private declared(expression: Expression, value: Expression | undefined): VariableNode {
    const arraySize = arraySizeOf(expression);
    const name = this.names.next('value');
    const { type, position } = expression;
    this.statements.push(declaration(name, type, value, position, arraySize));
    return variable(name, type, position, arraySize);
  }
}

/** `expression` with its parts replaced by `parts`, in the order `withSubExpressions` gives them. */
function rebuilt(expression: Expression, parts: readonly Expression[]): Expression {
  let next = 0;
  return withSubExpressions(expression, () => parts[next++]!);
}

/** `target = value`: an operator for a value type, a whole assignment for a struct or an array. */
function write(target: VariableNode, value: Expression): Statement {
  if (shapeOf(target.type) && arraySizeOf(target) === 0) return assign(target, value);
  return {
    kind: 'whole assign',
    type: target.type,
    target,
    value,
    position: target.position,
    ...(target.arraySize ? { arraySize: target.arraySize } : {}),
  };
}
