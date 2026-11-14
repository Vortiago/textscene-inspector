/**
 * The TSL node of each operator that reads its operands and writes nothing, by Godot's
 * enumerator. Godot writes each as its GLSL operator (`shader_compiler.cpp:1407`), so each node
 * computes what that GLSL operator computes for the operand types of its row.
 */

import {
  add,
  all,
  and,
  any,
  bitAnd,
  bitNot,
  bitOr,
  bitXor,
  div,
  equal,
  greaterThan,
  greaterThanEqual,
  int,
  lessThan,
  lessThanEqual,
  mod,
  mul,
  negate,
  not,
  notEqual,
  shiftLeft,
  shiftRight,
  sub,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { CONSTRUCTORS, floatNode } from './emitConstant.js';
import { shapeOf, type ValueType } from './types.js';

type Operation = (operands: readonly Node[], types: readonly ValueType[]) => Node;

/** three's types narrow each operator to a few node types. Each takes any node of a GLSL type. */
const tsl = (operator: unknown) => operator as (...operands: Node[]) => Node;

const binary =
  (operator: unknown): Operation =>
  ([first, second]) =>
    tsl(operator)(first!, second!);

/**
 * A binary operator over its operands, column by column where one operand is a matrix and the
 * other a scalar. three 0.187 writes `scalar op matrix` with no brackets and `matrix op scalar`
 * with the operands swapped (`OperatorNode.generate`), which `-` and `/` and any parent misread.
 */
const columnwise =
  (operator: unknown): Operation =>
  (operands, types) => {
    const matrix = types.findIndex((type) => shapeOf(type)!.columns !== undefined);
    const isByScalar = matrix !== -1 && types.some((type) => shapeOf(type)!.lanes === 1);
    if (!isByScalar) return tsl(operator)(operands[0]!, operands[1]!);
    const columnAt = (operand: number, column: number) =>
      operand === matrix ? columnOf(operands[operand]!, column) : operands[operand]!;
    return CONSTRUCTORS[types[matrix]!]!(
      ...Array.from({ length: shapeOf(types[matrix]!)!.columns! }, (_, column) =>
        tsl(operator)(columnAt(0, column), columnAt(1, column))
      )
    );
  };

const isMatrixByScalar = (types: readonly ValueType[]) =>
  shapeOf(types[0]!)!.columns !== undefined && shapeOf(types[1]!)!.lanes === 1;

/**
 * GLSL's `/`. glslang writes `matrix / scalar` as the matrix times the scalar's reciprocal, which
 * rounds twice, so a lane can land one unit off a true division, or flush to zero.
 */
function quotient(operands: readonly Node[], types: readonly ValueType[]): Node {
  if (!isMatrixByScalar(types)) return columnwise(div)(operands, types);
  return columnwise(mul)([operands[0]!, tsl(div)(floatNode(1), operands[1]!)], types);
}

const unary =
  (operator: unknown): Operation =>
  ([operand]) =>
    tsl(operator)(operand!);

/**
 * GLSL's `==` of two values: true when every lane is equal. A vector compares lane by lane, and a
 * matrix column by column.
 */
function isEqual([first, second]: readonly Node[], [type]: readonly ValueType[]): Node {
  const shape = shapeOf(type!)!;
  if (shape.columns !== undefined) {
    const columns = Array.from({ length: shape.columns }, (_, column) =>
      isEqual([columnOf(first!, column), columnOf(second!, column)], [`vec${shape.columns}`])
    );
    return columns.reduce((every, column) => tsl(and)(every, column));
  }
  if (shape.lanes === 1) return tsl(equal)(first!, second!);
  return tsl(all)(tsl(equal)(first!, second!));
}

/** GLSL's `!=` of two values: true when any lane differs. */
function isNotEqual(operands: readonly Node[], types: readonly ValueType[]): Node {
  const shape = shapeOf(types[0]!)!;
  if (shape.columns !== undefined) return tsl(not)(isEqual(operands, types));
  if (shape.lanes === 1) return tsl(notEqual)(operands[0]!, operands[1]!);
  return tsl(any)(tsl(notEqual)(operands[0]!, operands[1]!));
}

/** Element `index` of a vector or matrix node. */
export const element = (owner: Node, index: Node) =>
  (owner as unknown as { element(index: Node): Node }).element(index);

/** Column `column` of a matrix node. */
const columnOf = (matrix: Node, column: number): Node => element(matrix, int(column) as unknown as Node);

/** The operation of each operator that writes nothing, by Godot's enumerator. */
export const OPERATIONS: Readonly<Record<string, Operation>> = {
  OP_ADD: columnwise(add),
  OP_SUB: columnwise(sub),
  OP_MUL: columnwise(mul),
  OP_DIV: quotient,
  OP_MOD: binary(mod),
  OP_SHIFT_LEFT: binary(shiftLeft),
  OP_SHIFT_RIGHT: binary(shiftRight),
  OP_BIT_AND: binary(bitAnd),
  OP_BIT_OR: binary(bitOr),
  OP_BIT_XOR: binary(bitXor),
  OP_LESS: binary(lessThan),
  OP_LESS_EQUAL: binary(lessThanEqual),
  OP_GREATER: binary(greaterThan),
  OP_GREATER_EQUAL: binary(greaterThanEqual),
  OP_EQUAL: isEqual,
  OP_NOT_EQUAL: isNotEqual,
  OP_NEGATE: unary(negate),
  OP_NOT: unary(not),
  OP_BIT_INVERT: unary(bitNot),
};

/** The binary operator each compound assignment applies, `OP_ADD` for `OP_ASSIGN_ADD`. */
export function assignedOperator(op: string): string | undefined {
  return op === 'OP_ASSIGN' ? undefined : `OP_${op.slice('OP_ASSIGN_'.length)}`;
}

/**
 * The value of the constructor `type` over `operands`. three converts one float to a matrix as an
 * assignment GLSL refuses, so a matrix of one float is written as its diagonal, as GLSL reads it.
 */
export function constructed(
  type: ValueType,
  operands: readonly Node[],
  operandTypes: readonly ValueType[]
): Node {
  // A template's `sampler3D(texture, sampler)`: three keeps the sampler state on the texture.
  if (type.startsWith('sampler')) return operands[0]!;
  const columns = shapeOf(type)!.columns;
  if (columns === undefined || operandTypes.length !== 1 || operandTypes[0] !== 'float')
    return CONSTRUCTORS[type]!(...operands);
  const zero = floatNode(0);
  const diagonal = Array.from({ length: columns }, (_, column) =>
    CONSTRUCTORS[`vec${columns}`]!(
      ...Array.from({ length: columns }, (_, row) => (row === column ? operands[0]! : zero))
    )
  );
  return CONSTRUCTORS[type]!(...diagonal);
}
