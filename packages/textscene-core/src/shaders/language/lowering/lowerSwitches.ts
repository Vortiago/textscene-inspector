/**
 * Each `switch` as a chain of `if`s inside a `while (true)` that runs once, so a `break` leaves
 * it as it leaves the `switch`. A flag carries the fall from one label's body into the next, and
 * `default` runs where it stands when no label matches.
 */

import type { ControlFlowNode, Expression, FunctionNode, Statement } from '../shaderTree.js';
import type { FreshNames } from './freshNames.js';
import {
  assign,
  block,
  boolean,
  breakStatement,
  declaration,
  ifStatement,
  loop,
  not,
  operator,
  variable,
} from './nodes.js';
import { rewriteFunction } from './rewrite.js';

export function lowerSwitches(definition: FunctionNode, names: FreshNames): FunctionNode {
  return rewriteFunction(definition, (statement) =>
    statement.kind === 'control flow' && statement.flow === 'FLOW_OP_SWITCH'
      ? [switchChain(statement, names)]
      : [statement]
  );
}

/**
 * `{ T value = v; bool falls = false; bool matches = v == 1 || ...; while (true) {
 * if (falls || value == 1) { falls = true; body } ... if (falls || !matches) { ... } break; } }`.
 * The `matches` flag stands only where a `default` does.
 */
function switchChain(statement: ControlFlowNode, names: FreshNames): Statement {
  const position = statement.position;
  const valueNode = statement.expressions[0]!;
  const labels = statement.blocks[0]!.statements as ControlFlowNode[];
  const value = variable(names.next('switch_value'), valueNode.type, position);
  const falls = variable(names.next('falls'), 'bool', position);
  const declarations = [
    declaration(value.name, value.type, valueNode, position),
    declaration(falls.name, 'bool', boolean(false, position), position),
  ];
  const isMatch = (label: ControlFlowNode) =>
    operator('OP_EQUAL', [value, label.expressions[0]!], label.position);
  const cases = labels.filter((label) => label.flow === 'FLOW_OP_CASE');
  let noneMatches: Expression | undefined;
  if (labels.some((label) => label.flow === 'FLOW_OP_DEFAULT')) {
    const matches = variable(names.next('matches'), 'bool', position);
    const anyMatch =
      cases.length === 0
        ? boolean(false, position)
        : cases.map(isMatch).reduce((either, match) => operator('OP_OR', [either, match], position));
    declarations.push(declaration(matches.name, 'bool', anyMatch, position));
    noneMatches = not(matches);
  }
  const chain = labels.map((label) => {
    const runs = label.flow === 'FLOW_OP_CASE' ? isMatch(label) : noneMatches!;
    const body = [assign(falls, boolean(true, label.position)), label.blocks[0]!];
    return ifStatement(operator('OP_OR', [falls, runs], label.position), body, label.position);
  });
  return block([...declarations, loop([...chain, breakStatement(position)], position)], position);
}
