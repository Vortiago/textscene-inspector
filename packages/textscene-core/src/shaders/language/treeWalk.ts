/**
 * The parts of each node of the tree, in the order Godot writes them, so a pass that reads or
 * rebuilds every node names each kind once, here.
 */

import type { BlockNode, CallNode, ControlFlowNode, Expression, Statement } from './shaderTree.js';

/** Whether `statement` is the empty statement `;`. */
export const isEmpty = (statement: Statement): boolean =>
  statement.kind === 'operator' && statement.op === 'OP_EMPTY';

export const isReturn = (statement: Statement): statement is ControlFlowNode =>
  statement.kind === 'control flow' && statement.flow === 'FLOW_OP_RETURN';

/** The nodes Godot passes to an `out` or `inout` parameter (`shader_language.cpp:6408`). */
export const PLACE_KINDS: ReadonlySet<string> = new Set(['variable', 'array element', 'member', 'field']);

export const isCall = (expression: Expression): expression is CallNode =>
  expression.kind === 'operator' && expression.op === 'OP_CALL';

/** The element count of an array value, 0 for one value. */
export function arraySizeOf(expression: Expression): number {
  if (expression.kind === 'array construct') return expression.arraySize;
  if (expression.kind === 'variable' || expression.kind === 'field' || expression.kind === 'whole assign')
    return expression.arraySize ?? 0;
  if (isCall(expression)) return expression.arraySize ?? 0;
  return 0;
}

/** A type as Godot's messages name it: `float`, or `float[3]` for an array. */
export const typeName = (type: string, arraySize: number) => (arraySize > 0 ? `${type}[${arraySize}]` : type);

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

/** Every expression of each statement of `block` and of the blocks inside it. */
export function* everyExpressionIn(block: BlockNode): Generator<Expression> {
  for (const statement of everyStatement(block))
    for (const expression of statementExpressions(statement)) yield* everyExpression(expression);
}

/** Every expression of `expression`, itself first. */
export function* everyExpression(expression: Expression): Generator<Expression> {
  yield expression;
  for (const part of subExpressions(expression)) yield* everyExpression(part);
}
