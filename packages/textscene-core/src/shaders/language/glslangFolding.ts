/**
 * The constants Godot's GLSL compiler, glslang, folds, which the tree alone does not show. The
 * emitter writes each folded constant, so the GPU reads what Godot's GLSL holds, not what its own
 * arithmetic gives: a shift by 85 folds as a shift by 21, where the GPU gives zero.
 */

import { arraySizeOf } from './treeWalk.js';
import { binaryLane, convertedLane, unaryLane } from './glslangArithmetic.js';
import { godotConstantDouble } from './godotNumber.js';
import type { Expression, OperatorNode, Scalar } from './shaderTree.js';
import { swizzleLanes } from './swizzle.js';
import { filledLanes, shapeOf, type ScalarKind, type TypeShape, type ValueType } from './types.js';

export type Lanes = readonly Scalar[];

/**
 * The lanes of each expression glslang folds to a constant, a matrix's columns one after the
 * other, or nothing for one that reads a variable. glslang reads Godot's float constants as
 * doubles, folds in double precision and rounds once. A fold in 32-bit floats lands one unit off:
 * `58.656 + 74.377` is 0x43050873 in Godot, 0x43050872 so.
 */
export class GlslangFolding {
  /** Filled by `lanesOf` as it walks a function's tree, which never changes, and by `bindConstant`. */
  private readonly lanes = new WeakMap<Expression, Lanes | null>();

  /** Gives the read of a `const` local the lanes glslang folds its value to. */
  bindConstant(read: Expression, lanes: Lanes): void {
    this.lanes.set(read, lanes);
  }

  lanesOf(expression: Expression): Lanes | undefined {
    let lanes = this.lanes.get(expression);
    if (lanes === undefined) {
      lanes = this.fold(expression) ?? null;
      this.lanes.set(expression, lanes);
    }
    return lanes ?? undefined;
  }

  private fold(expression: Expression): Lanes | undefined {
    switch (expression.kind) {
      case 'constant':
        return shapeOf(expression.type)!.scalar === 'float'
          ? expression.values.map((value) => godotConstantDouble(value as number))
          : expression.values;
      case 'array length':
        return [arraySizeOf(expression.array)];
      case 'member': {
        const owner = this.lanesOf(expression.owner);
        return owner && swizzleLanes(expression).map((lane) => owner[lane]!);
      }
      case 'operator':
        // glslang folds no struct and no call of a function the shader declares.
        return expression.op === 'OP_STRUCT' || expression.op === 'OP_CALL'
          ? undefined
          : this.foldOperator(expression);
      default:
        return undefined;
    }
  }

  private foldOperator(node: OperatorNode): Lanes | undefined {
    const operands = node.operands.map((operand) => this.lanesOf(operand));
    if (!operands.every((operand) => operand !== undefined)) return undefined;
    const shapes = node.operands.map((operand) => shapeOf(operand.type)!);
    const shape = shapeOf(node.type)!;
    switch (node.op) {
      case 'OP_CONSTRUCT':
        return constructed(node.type, operands, shapes);
      case 'OP_INDEX':
        return element(operands[0]!, shapes[0]!, operands[1]![0] as number);
      case 'OP_SELECT_IF':
        return operands[0]![0] ? operands[1] : operands[2];
      case 'OP_EQUAL':
        return equality(isEqual(operands[0]!, operands[1]!), shapes[0]!);
      case 'OP_NOT_EQUAL':
        return equality(!isEqual(operands[0]!, operands[1]!), shapes[0]!);
    }
    if (operands.length === 1) return unary(node.op, shape, operands[0]!);
    if (node.op === 'OP_MUL') {
      const product = matrixProduct(operands[0]!, shapes[0]!, operands[1]!, shapes[1]!);
      if (product) return product;
    }
    return lanewise(node.op, shapes[0]!.scalar, shape.lanes, operands[0]!, operands[1]!);
  }
}

/**
 * A constructor of constants (`foldConstructor`): each lane converted to the type's scalar, one
 * scalar filling a vector or a matrix's diagonal. A matrix of a matrix is left to the GPU.
 */
function constructed(type: ValueType, operands: readonly Lanes[], shapes: readonly TypeShape[]) {
  const shape = shapeOf(type)!;
  const lanes = operands.flatMap((operand, index) =>
    operand
      .slice(0, shapes[index]!.lanes)
      .map((lane) => convertedLane(lane, shapes[index]!.scalar, shape.scalar))
  );
  if (lanes.length === shape.lanes) return lanes;
  if (lanes.length !== 1 || shapes[0]!.lanes !== 1) return undefined;
  return filledLanes(lanes[0]!, type);
}

/** `owner[index]` (`foldDereference`): a vector's lane or a matrix's column. */
function element(owner: Lanes, shape: TypeShape, index: number): Lanes | undefined {
  const size = shape.columns === undefined ? 1 : shape.columns;
  if (index < 0 || (index + 1) * size > owner.length) return undefined;
  return owner.slice(index * size, (index + 1) * size);
}

/**
 * The constant of `==` or `!=`: glslang sizes it as the left operand (`Constant.cpp:101`) and sets
 * lane 0 alone, so the boolean carries a zero `int` for each other lane. A later `==` compares
 * those too: `(vec2(1.0) == vec2(2.0)) == (1 == 2)` folds to false.
 */
function equality(result: boolean, left: TypeShape): Lanes {
  return [result, ...Array<Scalar>(left.lanes - 1).fill(0)];
}

/** `==` of two constants: every lane equal, a float lane compared as a double. */
const isEqual = (a: Lanes, b: Lanes) => a.length === b.length && a.every((lane, index) => lane === b[index]);

function unary(op: string, shape: TypeShape, operand: Lanes): Lanes | undefined {
  const lanes = operand.slice(0, shape.lanes).map((lane) => unaryLane(op, shape.scalar, lane));
  return lanes.every((lane) => lane !== undefined) ? lanes : undefined;
}

/** A binary operator lane by lane, a scalar operand standing for every lane of the other. */
function lanewise(op: string, scalar: ScalarKind, lanes: number, left: Lanes, right: Lanes) {
  const apply = binaryLane(op, scalar);
  if (!apply) return undefined;
  return Array.from({ length: lanes }, (_, lane) => apply(laneAt(left, lane), laneAt(right, lane)));
}

const laneAt = (lanes: Lanes, lane: number) => lanes[lanes.length === 1 ? 0 : lane]!;

/**
 * `matrix * matrix`, `matrix * vector` or `vector * matrix` as glslang folds it: each lane a sum
 * of products in double precision, from the first term on. Nothing for a product lane by lane.
 */
function matrixProduct(left: Lanes, leftShape: TypeShape, right: Lanes, rightShape: TypeShape) {
  const rows = leftShape.columns ?? (rightShape.columns === undefined ? undefined : 1);
  const columns = rightShape.columns ?? (leftShape.columns === undefined ? undefined : 1);
  if (rows === undefined || columns === undefined || leftShape.lanes === 1 || rightShape.lanes === 1)
    return undefined;
  const inner = left.length / rows;
  const lanes: number[] = [];
  for (let column = 0; column < columns; column += 1)
    for (let row = 0; row < rows; row += 1) {
      let sum = 0;
      for (let term = 0; term < inner; term += 1)
        sum += (left[term * rows + row] as number) * (right[column * inner + term] as number);
      lanes.push(sum);
    }
  return lanes;
}
