/**
 * The tree check: the facts every tree the parser gives must hold, so a parser change that breaks
 * one fails a test. Every node has a value type, every row fits its operand types, every name is
 * an argument of its function, and every constant lane fits its type.
 */

import { assignmentRefusal } from './assignment.js';
import { signatureInstruction } from './instructions.js';
import { isAssignOperator } from './operators.js';
import type {
  Argument,
  ConstantNode,
  Expression,
  FunctionNode,
  ShaderNode,
  Statement,
} from './shaderTree.js';
import { swizzled } from './swizzle.js';
import { elementType, shapeOf } from './types.js';

/** The first fact `shader` breaks, or nothing when it holds them all. */
export function treeFault(shader: ShaderNode): string | undefined {
  for (const definition of shader.functions) {
    const fault = functionFault(definition);
    if (fault !== undefined) return `${definition.name}: ${fault}`;
  }
  return undefined;
}

function functionFault(definition: FunctionNode): string | undefined {
  for (const statement of definition.body.statements) {
    const fault = statementFault(statement, definition);
    if (fault !== undefined) return fault;
  }
  return undefined;
}

function statementFault(statement: Statement, definition: FunctionNode): string | undefined {
  if (statement.kind === 'control flow') {
    const value = statement.expressions[0];
    if ((value?.type ?? 'void') !== definition.returnType)
      return `a return of ${value?.type ?? 'void'} in a function of ${definition.returnType}`;
    return value && expressionFault(value, definition.arguments);
  }
  if (statement.kind === 'operator' && statement.op === 'OP_EMPTY') return undefined;
  return expressionFault(statement, definition.arguments);
}

function expressionFault(expression: Expression, args: readonly Argument[]): string | undefined {
  if (shapeOf(expression.type) === undefined) return `a ${expression.kind} of type ${expression.type}`;
  switch (expression.kind) {
    case 'constant':
      return constantFault(expression);
    case 'variable': {
      const argument = args.find((candidate) => candidate.name === expression.name);
      if (argument?.type !== expression.type)
        return `the name ${expression.name} is no argument of type ${expression.type}`;
      return undefined;
    }
    case 'member': {
      const member = swizzled(expression.owner, expression.name);
      if (typeof member === 'string' || member.type !== expression.type || member.row !== expression.row)
        return `the swizzle .${expression.name} of ${expression.owner.type}`;
      return expressionFault(expression.owner, args);
    }
    case 'operator': {
      for (const operand of expression.operands) {
        const fault = expressionFault(operand, args);
        if (fault !== undefined) return fault;
      }
      return operatorFault(expression);
    }
  }
}

const STEP_OPERATORS: ReadonlySet<string> = new Set([
  'OP_INCREMENT',
  'OP_DECREMENT',
  'OP_POST_INCREMENT',
  'OP_POST_DECREMENT',
]);

function operatorFault(expression: Extract<Expression, { kind: 'operator' }>): string | undefined {
  const { op, operands, row, type } = expression;
  const types = operands.map((operand) => operand.type);
  if (op === 'OP_INDEX') {
    const indexType = types[1];
    if (elementType(types[0]!) !== type || (indexType !== 'int' && indexType !== 'uint'))
      return `an index of ${types.join(', ')} typed ${type}`;
  } else if (op === 'OP_CONSTRUCT') {
    if (row.id !== `${row.id.slice(0, row.id.indexOf('('))}(${types.join(',')})` || row.returns !== type)
      return `the constructor row ${row.id} over ${types.join(', ')}`;
  } else if (signatureInstruction(op, types) !== row || row.returns !== type) {
    return `the row ${row.id} over ${types.join(', ')}`;
  }
  const isWrite = isAssignOperator(op) || STEP_OPERATORS.has(op);
  if (isWrite && assignmentRefusal(operands[0]!) !== undefined) return `a write to ${operands[0]!.kind}`;
  return undefined;
}

/** A lane of each scalar kind as Godot holds it (`shaderTree.ts`, `ConstantNode`). */
const LANE_FITS: Readonly<Record<string, (lane: number | boolean) => boolean>> = {
  bool: (lane) => typeof lane === 'boolean',
  int: (lane) => Number.isInteger(lane) && (lane as number) >= -0x80000000 && (lane as number) <= 0x7fffffff,
  uint: (lane) => Number.isInteger(lane) && (lane as number) >= 0 && (lane as number) <= 0xffffffff,
  float: (lane) => typeof lane === 'number' && Object.is(Math.fround(lane), lane),
};

function constantFault(constant: ConstantNode): string | undefined {
  const shape = shapeOf(constant.type)!;
  if (constant.values.length !== shape.lanes)
    return `a ${constant.type} constant of ${constant.values.length} lanes`;
  if (!constant.values.every(LANE_FITS[shape.scalar]!))
    return `a ${constant.type} constant ${constant.values.join(', ')}`;
  return undefined;
}
