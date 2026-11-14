/**
 * A function with one exit, its last statement: TSL's `Fn` gives its value as it ends, and has
 * no `return` with a value inside a branch. A `return` inside sets the result and a flag, leaves
 * each loop around it, and the flag skips each statement after it. Runs after the loops and the
 * switches are lowered, so each loop is a `while (true)`.
 */

import type { BlockNode, ControlFlowNode, FunctionNode, Statement, VariableNode } from '../shaderTree.js';
import { everyStatement, isReturn } from '../treeWalk.js';
import type { FreshNames } from './freshNames.js';
import {
  assign,
  block,
  boolean,
  breakStatement,
  declaration,
  flow,
  flowBody,
  ifStatement,
  not,
  variable,
} from './nodes.js';

export function lowerReturns(definition: FunctionNode, names: FreshNames): FunctionNode {
  const statements = definition.body.statements;
  const returns = [...everyStatement(definition.body)].filter(isReturn);
  const isOnlyLast = returns.length === 1 && returns[0] === statements.at(-1);
  if (returns.length === 0 || isOnlyLast) return definition;
  const position = definition.body.position;
  const exit = new SingleExit(
    variable(names.next('returned'), 'bool', position),
    definition.returnType === 'void'
      ? undefined
      : variable(names.next('result'), definition.returnType, position, definition.returnArraySize)
  );
  const head = [
    ...(exit.result
      ? [declaration(exit.result.name, exit.result.type, undefined, position, exit.result.arraySize)]
      : []),
    declaration(exit.returned.name, 'bool', boolean(false, position), position),
  ];
  const tail = exit.result ? [flow('FLOW_OP_RETURN', [exit.result], [], position)] : [];
  const body = [...head, ...exit.statements(statements, false), ...tail];
  return { ...definition, body: { ...definition.body, statements: body } };
}

class SingleExit {
  constructor(
    readonly returned: VariableNode,
    readonly result: VariableNode | undefined
  ) {}

  /**
   * `statements` with each `return` set into the result. A `return` in a loop breaks it, and
   * after a loop that holds one, `if (returned) break;` leaves the loop around it.
   * Outside a loop, the statements after one that holds a `return` run under `if (!returned)`.
   */
  statements(statements: readonly Statement[], isInLoop: boolean): Statement[] {
    const lowered: Statement[] = [];
    for (const [index, statement] of statements.entries()) {
      if (isReturn(statement)) return [...lowered, ...this.exit(statement, isInLoop)];
      if (!holdsReturn(statement)) {
        lowered.push(statement);
        continue;
      }
      lowered.push(this.statement(statement, isInLoop));
      if (isInLoop) {
        if (isLoop(statement))
          lowered.push(ifStatement(this.returned, [breakStatement(statement.position)], statement.position));
        continue;
      }
      const rest = statements.slice(index + 1);
      if (rest.length === 0) return lowered;
      return [...lowered, ifStatement(not(this.returned), this.statements(rest, false), statement.position)];
    }
    return lowered;
  }

  private statement(statement: Statement, isInLoop: boolean): Statement {
    if (statement.kind === 'block') return this.block(statement, isInLoop);
    const flowStatement = statement as ControlFlowNode;
    const isBodyInLoop = isInLoop || isLoop(flowStatement);
    const blocks = flowStatement.blocks.map((inner) =>
      flowBody(this.statements(inner.statements, isBodyInLoop), inner.position)
    );
    return { ...flowStatement, blocks };
  }

  private block(inner: BlockNode, isInLoop: boolean): BlockNode {
    return { ...inner, statements: this.statements(inner.statements, isInLoop) };
  }

  /** `result = value; returned = true;`, and `break;` inside a loop. */
  private exit(statement: ControlFlowNode, isInLoop: boolean): Statement[] {
    const [value] = statement.expressions;
    const position = statement.position;
    return [
      ...(value && this.result ? [assign(this.result, value)] : []),
      assign(this.returned, boolean(true, position)),
      ...(isInLoop ? [breakStatement(position)] : []),
    ];
  }
}

const isLoop = (statement: Statement) =>
  statement.kind === 'control flow' && statement.flow === 'FLOW_OP_WHILE';

const holdsReturn = (statement: Statement) =>
  [...everyStatement(block([statement], statement.position))].some(isReturn);
