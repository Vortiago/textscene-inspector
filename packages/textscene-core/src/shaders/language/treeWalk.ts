/**
 * The parts of each node of the tree, in the order Godot writes them, so a pass that reads or
 * rebuilds every node names each kind once, here.
 */

import type { BlockNode, Expression, Statement } from './shaderTree.js';

/** The expressions `expression` holds. */
export function subExpressions(expression: Expression): readonly Expression[] {
  switch (expression.kind) {
    case 'constant':
    case 'variable':
      return [];
    case 'member':
    case 'field':
      return [expression.owner];
    case 'operator':
      return expression.operands;
    case 'array element':
      return [expression.array, expression.index];
    case 'array construct':
      return expression.elements;
    case 'array length':
      return [expression.array];
    case 'whole assign':
      return [expression.target, expression.value];
  }
}

/** `expression` with each expression it holds replaced by `map` of it. */
export function withSubExpressions(
  expression: Expression,
  map: (part: Expression) => Expression
): Expression {
  switch (expression.kind) {
    case 'constant':
    case 'variable':
      return expression;
    case 'member':
    case 'field':
      return { ...expression, owner: map(expression.owner) };
    case 'operator':
      return { ...expression, operands: expression.operands.map(map) };
    case 'array element':
      return { ...expression, array: map(expression.array), index: map(expression.index) };
    case 'array construct':
      return { ...expression, elements: expression.elements.map(map) };
    case 'array length':
      return { ...expression, array: map(expression.array) };
    case 'whole assign':
      return { ...expression, target: map(expression.target), value: map(expression.value) };
  }
}

/** The expressions a statement holds itself, outside its blocks. */
export function statementExpressions(statement: Statement): readonly Expression[] {
  switch (statement.kind) {
    case 'control flow':
      return statement.expressions;
    case 'declaration':
      return statement.declarators.flatMap((declarator) => (declarator.value ? [declarator.value] : []));
    case 'block':
      return [];
    default:
      return [statement];
  }
}

/** The blocks a statement holds: a block itself, or a flow's blocks. */
export function statementBlocks(statement: Statement): readonly BlockNode[] {
  if (statement.kind === 'block') return [statement];
  return statement.kind === 'control flow' ? statement.blocks : [];
}

/** Every statement of `block` and of the blocks inside it, each before the statements it holds. */
export function* everyStatement(block: BlockNode): Generator<Statement> {
  for (const statement of block.statements) {
    yield statement;
    for (const inner of statementBlocks(statement)) yield* everyStatement(inner);
  }
}

/** Every expression of `expression`, itself first. */
export function* everyExpression(expression: Expression): Generator<Expression> {
  yield expression;
  for (const part of subExpressions(expression)) yield* everyExpression(part);
}
