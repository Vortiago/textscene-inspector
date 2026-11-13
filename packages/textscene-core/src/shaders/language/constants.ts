/**
 * Godot's rules for constants in the tree: `convert_constant` (`shader_language.cpp:4183`), which
 * lets a scalar literal stand for another scalar type in a constructor, and `_reduce_expression`
 * (`shader_language.cpp:7840`), which folds constructors and negations of constants.
 */

import type { ConstantNode, Expression, OperatorNode, Scalar } from './shaderTree.js';
import { shapeOf, type ValueType } from './types.js';

/**
 * The lane of the scalar constant `constant` as type `to`, or nothing where Godot converts none:
 * `int` and `uint` to `float`, a non-negative `int` to `uint`, and a `uint` up to 2^31 - 1 to `int`.
 */
export function convertedScalar(constant: ConstantNode, to: ValueType): Scalar | undefined {
  const value = constant.values[0]!;
  if (constant.type === to) return value;
  if ((constant.type === 'int' || constant.type === 'uint') && to === 'float')
    return Math.fround(value as number);
  if (constant.type === 'int' && to === 'uint') return (value as number) < 0 ? undefined : value;
  if (constant.type === 'uint' && to === 'int') return (value as number) > 0x7fffffff ? undefined : value;
  return undefined;
}

/**
 * `_reduce_expression`: a constructor of constants becomes one constant (line 7848), and so does a
 * negation of a constant (line 7909). It reaches through constructors and negations only, so
 * `-(-1.5) + a` keeps its outer negation.
 */
export function reduced(expression: Expression): Expression {
  if (expression.kind !== 'operator') return expression;
  if (expression.op === 'OP_CONSTRUCT') return reducedConstruction(expression);
  if (expression.op === 'OP_NEGATE') return reducedNegation(expression);
  return expression;
}

function reducedConstruction(construction: OperatorNode): Expression {
  const operands = construction.operands.map(reduced);
  const node = { ...construction, operands };
  if (!operands.every((operand): operand is ConstantNode => operand.kind === 'constant')) return node;
  const shape = shapeOf(construction.type)!;
  const values: Scalar[] = [];
  for (const operand of operands) {
    if (shapeOf(operand.type)!.scalar === shape.scalar) values.push(...operand.values);
    else if (shapeOf(operand.type)!.lanes === 1) {
      const value = convertedScalar(operand, shape.scalar);
      if (value === undefined) return node;
      values.push(value);
    } else return node;
  }
  if (values.length === 1) return constantOf(construction, spread(values[0]!, construction.type));
  // Godot prints an error and keeps the constructor when the lanes do not fill the type (line 7898).
  if (values.length !== shape.lanes) return node;
  return constantOf(construction, values);
}

/** One lane filling a vector, or the diagonal of a matrix with zeros elsewhere (line 7882). */
function spread(value: Scalar, type: ValueType): Scalar[] {
  const shape = shapeOf(type)!;
  if (shape.columns === undefined) return Array<Scalar>(shape.lanes).fill(value);
  return Array.from({ length: shape.lanes }, (_, lane) =>
    Math.floor(lane / shape.columns!) === lane % shape.columns! ? value : 0
  );
}

function reducedNegation(negation: OperatorNode): Expression {
  const operand = reduced(negation.operands[0]!);
  if (operand.kind !== 'constant') return { ...negation, operands: [operand] };
  return {
    ...operand,
    values: operand.values.map((value) => negatedScalar(value, shapeOf(operand.type)!.scalar)),
  };
}

/** Godot's negation of one lane: `!` for a bool, and an `int` or `uint` wraps as GLSL does (line 7920). */
function negatedScalar(value: Scalar, scalar: string): Scalar {
  if (scalar === 'bool') return !value;
  if (scalar === 'int') return -(value as number) | 0;
  if (scalar === 'uint') return (0 - (value as number)) >>> 0;
  return -(value as number);
}

const constantOf = (node: OperatorNode, values: Scalar[]): ConstantNode => ({
  kind: 'constant',
  type: node.type,
  values,
  position: node.position,
});
