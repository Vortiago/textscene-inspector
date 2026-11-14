/**
 * The tree GLSL reads from the text Godot writes for a tree (`_dump_node_code`,
 * `shader_compiler.cpp:1117`). Godot writes a negation, a prefix step and an assignment without
 * brackets, so the operator beside one can bind to a part of it. The emitter emits the tree GLSL
 * reads, so the GPU computes what Godot's GLSL computes, and refuses a text GLSL refuses.
 */

import { assignmentRefusal } from './assignment.js';
import { signatureInstruction } from './instructions.js';
import { isAssignOperator } from './operators.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import type { BlockNode, Expression, OperatorNode, Statement } from './shaderTree.js';
import { swizzled } from './swizzle.js';
import { statementBlocks, withSubExpressions } from './treeWalk.js';
import { elementType, shapeOf } from './types.js';

/** The operators Godot writes as their sign before their operand's text (`shader_compiler.cpp:1134`). */
const PREFIX_OPERATORS: ReadonlySet<string> = new Set([
  'OP_NEGATE',
  'OP_NOT',
  'OP_BIT_INVERT',
  'OP_INCREMENT',
  'OP_DECREMENT',
]);

const PREFIX_STEPS: ReadonlySet<string> = new Set(['OP_INCREMENT', 'OP_DECREMENT']);

/** The operators Godot writes after their first operand's text, `a[0]`, `a++` and `a = b`. */
const TEXT_LEADS_WITH_OPERAND: ReadonlySet<string> = new Set([
  'OP_INDEX',
  'OP_POST_INCREMENT',
  'OP_POST_DECREMENT',
]);

/** Godot writes a binary operator in brackets, and these in their own forms. */
const OWN_FORM_OPERATORS: ReadonlySet<string> = new Set([
  'OP_CONSTRUCT',
  'OP_STRUCT',
  'OP_SELECT_IF',
  'OP_EMPTY',
]);

/** The block GLSL reads from Godot's text of `block`. */
export function glslBlock(block: BlockNode): BlockNode {
  return { ...block, statements: block.statements.map(glslStatement) };
}

function glslStatement(statement: Statement): Statement {
  switch (statement.kind) {
    case 'block':
      return glslBlock(statement);
    case 'declaration':
      return {
        ...statement,
        declarators: statement.declarators.map((declarator) =>
          declarator.value ? { ...declarator, value: glslStatementExpression(declarator.value) } : declarator
        ),
      };
    case 'control flow':
      return {
        ...statement,
        expressions: statement.expressions.map(glslExpression),
        blocks: statementBlocks(statement).map(glslBlock),
      };
    default:
      return glslStatementExpression(statement);
  }
}

/**
 * The expression a statement or a declaration holds. Godot writes an array's or a struct's
 * assignment as `a=b` (`shader_compiler.cpp:1078`), which GLSL reads as Godot means only where
 * no operator, swizzle or index stands beside it.
 */
function glslStatementExpression(expression: Expression): Expression {
  if (expression.kind !== 'whole assign') return glslExpression(expression);
  return {
    ...expression,
    target: glslExpression(expression.target),
    value: glslStatementExpression(expression.value),
  };
}

/** The tree GLSL reads from Godot's text of `expression`. */
function glslExpression(expression: Expression): Expression {
  switch (expression.kind) {
    case 'constant':
    case 'variable':
      return expression;
    case 'whole assign':
      return refuse(expression);
    case 'array element':
    case 'array construct':
    case 'array length':
    case 'field':
      return withSubExpressions(expression, glslExpression);
    case 'member':
      return glslMember(glslExpression(expression.owner), expression.name, expression);
    case 'operator':
      return glslOperator({ ...expression, operands: expression.operands.map(glslExpression) });
  }
}

function glslOperator(node: OperatorNode): Expression {
  const { op, operands } = node;
  const [first, second, third] = operands;
  if (op === 'OP_NEGATE' && textStartsWithMinus(first!)) return first!;
  if (PREFIX_OPERATORS.has(op)) return isAssignment(first!) ? refuse(node) : node;
  if (isAssignOperator(op))
    return isAssignment(first!)
      ? lastExtended(first, (last) => typed(op, [place(last), second!], node))
      : node;
  if (op === 'OP_INDEX') return glslIndex(first!, second!, node);
  if (TEXT_LEADS_WITH_OPERAND.has(op))
    return isAssignment(first!) ? lastExtended(first, (last) => typed(op, [place(last)], node)) : node;
  if (op === 'OP_SELECT_IF') {
    if (isAssignment(third!)) refuse(node);
    return isAssignment(first!)
      ? lastExtended(first, (last) => typed(op, [last, second!, third!], node))
      : node;
  }
  if (OWN_FORM_OPERATORS.has(op)) return node;
  if (isAssignment(second!)) refuse(node);
  return isAssignment(first!) ? lastExtended(first, (last) => typed(op, [last, second!], node)) : node;
}

/** `owner.letters`. Godot writes a swizzle after its owner's text, so it binds to the last operand of an assignment or a prefix step. */
function glslMember(owner: Expression, letters: string, node: Expression): Expression {
  const swizzle = (of: Expression) => {
    const member = swizzled(of, letters);
    return typeof member === 'string' ? refuse(node) : member;
  };
  if (isAssignment(owner)) return lastExtended(owner, swizzle);
  if (isPrefixStep(owner)) return typed(owner.op, [place(swizzle(owner.operands[0]!))], node);
  return swizzle(owner);
}

/** `owner[index]`, which binds as a swizzle does. */
function glslIndex(owner: Expression, index: Expression, node: OperatorNode): Expression {
  const indexed = (of: Expression): Expression => {
    const type = elementType(of.type);
    return type === undefined ? refuse(node) : { ...node, type, operands: [of, index] };
  };
  if (isAssignment(owner)) return lastExtended(owner, indexed);
  if (isPrefixStep(owner)) return typed(owner.op, [place(indexed(owner.operands[0]!))], node);
  return indexed(owner);
}

/** The assignment `assignment` with `extend` applied to its last operand, through a chain of assignments. */
function lastExtended(
  assignment: Expression | undefined,
  extend: (last: Expression) => Expression
): Expression {
  const node = assignment as OperatorNode;
  const [target, value] = node.operands as [Expression, Expression];
  const extended = isAssignment(value) ? lastExtended(value, extend) : extend(value);
  return typed(node.op, [target, extended], node);
}

/** The operator `op` over `operands`, typed by its row, or the refusal of a text GLSL refuses. */
function typed(op: string, operands: readonly Expression[], at: Expression): OperatorNode {
  const row = signatureInstruction(
    op,
    operands.map((operand) => operand.type)
  );
  if (!row) refuse(at);
  return { kind: 'operator', type: row.returns!, op, row, operands, position: at.position };
}

/** `expression` as the target of an assignment or a step, or the refusal GLSL gives when it is not one. */
function place(expression: Expression): Expression {
  return assignmentRefusal(expression) === undefined && !isAssignment(expression)
    ? expression
    : refuse(expression);
}

const isAssignment = (expression: Expression): boolean =>
  expression.kind === 'operator' && isAssignOperator(expression.op);

const isPrefixStep = (expression: Expression): expression is OperatorNode =>
  expression.kind === 'operator' && PREFIX_STEPS.has(expression.op);

function refuse(at: Expression): never {
  throw new ShadingLanguageError(
    'Godot writes this expression without brackets, as GLSL the GPU compiler refuses.',
    at.position
  );
}

/**
 * Whether Godot's text of `expression` starts with `-`: a negation, a `--a`, a negative scalar
 * constant, or a swizzle, element, post step or assignment of such a text. A vector constant's
 * text starts with its type, and a binary operator's with `(`.
 */
function textStartsWithMinus(expression: Expression): boolean {
  switch (expression.kind) {
    case 'constant':
      return shapeOf(expression.type)!.lanes === 1 && signBit(expression.values[0] as number);
    case 'member':
      return textStartsWithMinus(expression.owner);
    case 'operator':
      if (expression.op === 'OP_NEGATE' || expression.op === 'OP_DECREMENT') return true;
      if (TEXT_LEADS_WITH_OPERAND.has(expression.op) || isAssignOperator(expression.op))
        return textStartsWithMinus(expression.operands[0]!);
      return false;
    default:
      return false;
  }
}

const signBit = (value: number) => value < 0 || Object.is(value, -0);
