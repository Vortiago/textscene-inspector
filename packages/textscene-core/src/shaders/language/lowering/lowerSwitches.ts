import type {
  BlockNode,
  ControlFlowNode,
  Expression,
  FunctionNode,
  Statement,
  VariableNode,
} from '../shaderTree.js';
import type { FreshNames } from './freshNames.js';
import {
  assign,
  block,
  boolean,
  breakStatement,
  declaration,
  flow,
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
      ? switchChain(statement, names)
      : statement
  );
}

/** A `while (true)` of `falls` checks, with `matches` for a `default` and `continues` for a `continue`. */
function switchChain(statement: ControlFlowNode, names: FreshNames): Statement {
  const position = statement.position;
  const valueNode = statement.expressions[0]!;
  let continues: VariableNode | undefined;
  const continuesFlag = () => (continues ??= variable(names.next('continues'), 'bool', position));
  const labels = (statement.blocks[0]!.statements as ControlFlowNode[]).map((label) => ({
    ...label,
    blocks: [continuesAsBreaks(label.blocks[0]!, continuesFlag)],
  }));
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
  const lowered: Statement[] = [loop([...chain, breakStatement(position)], position)];
  if (continues) {
    declarations.push(declaration(continues.name, 'bool', boolean(false, position), position));
    lowered.push(ifStatement(continues, [flow('FLOW_OP_CONTINUE', [], [], position)], position));
  }
  return block([...declarations, ...lowered], position);
}

/** The loops a `continue` inside the switch may stand in, which it then continues. */
const LOOPS: ReadonlySet<string> = new Set(['FLOW_OP_WHILE', 'FLOW_OP_FOR', 'FLOW_OP_DO']);

/** `body` with each `continue` of the switch's loop as `continues = true; break;`, leaving the chain. */
function continuesAsBreaks(body: BlockNode, continues: () => VariableNode): BlockNode {
  const statements = body.statements.map((statement): Statement => {
    if (statement.kind === 'block') return continuesAsBreaks(statement, continues);
    if (statement.kind !== 'control flow' || LOOPS.has(statement.flow)) return statement;
    if (statement.flow !== 'FLOW_OP_CONTINUE')
      return { ...statement, blocks: statement.blocks.map((inner) => continuesAsBreaks(inner, continues)) };
    const { position } = statement;
    return block([assign(continues(), boolean(true, position)), breakStatement(position)], position);
  });
  return { ...body, statements };
}
