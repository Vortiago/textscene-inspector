/**
 * The tree of a random program and its shading language text. Each node that applies an
 * instruction holds its row, so the rows a program uses are read from its tree. The text takes
 * only the brackets Godot's priorities need, and those a node asks for, so a program tests
 * operator order as a user's shader does.
 */

import {
  LOOSEST,
  isInfix,
  isPrefix,
  operatorExpression,
  operatorPriority,
} from '../operators/operatorText.mjs';

/** The name of parameter `index`. */
const parameterName = (index) => `a${index}`;

/** The text of `node`. */
export function expressionText(node) {
  const text = bareText(node);
  return node.bracketed ? `(${text})` : text;
}

function bareText(node) {
  switch (node.kind) {
    case 'parameter':
      return parameterName(node.index);
    case 'literal':
      return node.text;
    case 'call':
      return `${node.name}(${node.args.map(expressionText).join(', ')})`;
    case 'swizzle':
      return `${operandText(node.base, needsBracketsAsBase(node.base))}.${node.letters}`;
    case 'operator':
      return operatorExpression(
        node.op,
        node.operands.map((operand, position) => operandText(operand, needsBrackets(operand, node, position)))
      );
  }
  throw new Error(`expected a program tree node, got ${node.kind}`);
}

const operandText = (node, bracket) =>
  bracket && !node.bracketed ? `(${expressionText(node)})` : expressionText(node);

const isOperator = (node) => node.kind === 'operator';

/** A swizzle base that is an operator takes brackets: a member binds before any operator. */
const needsBracketsAsBase = (base) => isOperator(base) && operatorPriority(base.op) > 0;

/**
 * Whether operand `position` of `parent` takes brackets. Of two infix operators of one
 * priority, the left binds first, so a right operand of equal priority takes them. A prefix
 * operator takes them around any operator but a postfix one, which also keeps `- -a` from
 * reading as `--a`. A ternary or an assignment takes them as an operand and around its own.
 */
function needsBrackets(operand, parent, position) {
  if (!isOperator(operand) || operatorPriority(operand.op) === 0) return false;
  if (isPrefix(parent.op)) return true;
  const parentPriority = operatorPriority(parent.op);
  if (!isInfix(parent.op) || parentPriority === LOOSEST) return true;
  if (isPrefix(operand.op)) return false;
  const priority = operatorPriority(operand.op);
  if (!isInfix(operand.op) || priority === LOOSEST) return true;
  return priority > parentPriority || (priority === parentPriority && position === 1);
}

/** Every node of `node`'s tree, `node` first. */
export function treeNodes(node) {
  return [node, ...childrenOf(node).flatMap(treeNodes)];
}

/** The operands, arguments or base of `node`. */
export function childrenOf(node) {
  if (node.kind === 'operator') return node.operands;
  if (node.kind === 'call') return node.args;
  if (node.kind === 'swizzle') return [node.base];
  return [];
}

/** `node` with child `index` replaced by `child`. */
export function withChild(node, index, child) {
  if (node.kind === 'operator') return { ...node, operands: node.operands.with(index, child) };
  if (node.kind === 'call') return { ...node, args: node.args.with(index, child) };
  return { ...node, base: child };
}

/** The ids of the rows the tree of `node` applies, each once, in tree order. */
export function rowsOf(node) {
  return [...new Set(treeNodes(node).flatMap((each) => (each.row ? [each.row.id] : [])))];
}

/** The text of a program's `probe` function. */
export function programSource({ returns, parameters, tree }) {
  const list = parameters.map((type, index) => `${type} ${parameterName(index)}`).join(', ');
  return `${returns} probe(${list}) { return ${expressionText(tree)}; }`;
}
