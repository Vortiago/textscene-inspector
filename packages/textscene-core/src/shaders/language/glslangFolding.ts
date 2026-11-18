import { arraySizeOf, isCall } from './treeWalk.js';
import { binaryLane, convertedLane, unaryLane } from './glslangArithmetic.js';
import { foldedCall, type Lanes } from './glslangCalls.js';
import { godotConstantDouble } from './godotNumber.js';
import type { CallNode, Expression, OperatorNode, Scalar } from './shaderTree.js';
import { swizzleLanes } from './swizzle.js';
import { filledLanes, shapeOf, type ScalarKind, type TypeShape, type ValueType } from './types.js';

export type { Lanes };

/** glslang folds in double precision and rounds once: `58.656 + 74.377` is 0x43050873, not ...72. */
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
        if (expression.op === 'OP_STRUCT') return undefined;
        return isCall(expression) ? this.foldCall(expression) : this.foldOperator(expression);
      default:
        return undefined;
    }
  }

  /** A call of a built-in on constants alone. glslang folds no call of a function the shader declares. */
  private foldCall(call: CallNode): Lanes | undefined {
    if (call.row.id === 'OP_CALL') return undefined;
    const args = call.operands.map((operand) => this.lanesOf(operand));
    if (!args.every((arg) => arg !== undefined)) return undefined;
    return foldedCall(
      call.function,
      args,
      call.operands.map((operand) => shapeOf(operand.type)!)
    );
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

/** `foldConstructor`: one scalar fills a vector or a matrix's diagonal. */
function constructed(type: ValueType, operands: readonly Lanes[], shapes: readonly TypeShape[]) {
  const shape = shapeOf(type)!;
  if (shape.columns !== undefined && shapes.length === 1 && shapes[0]!.columns !== undefined)
    return matrixOfMatrix(shape.columns, operands[0]!, shapes[0]!.columns);
  const lanes = operands.flatMap((operand, index) =>
    operand
      .slice(0, shapes[index]!.lanes)
      .map((lane) => convertedLane(lane, shapes[index]!.scalar, shape.scalar))
  );
  if (lanes.length === shape.lanes) return lanes;
  if (lanes.length !== 1 || shapes[0]!.lanes !== 1) return undefined;
  return filledLanes(lanes[0]!, type);
}

/** Lanes inside the source come from it, and the identity elsewhere (`parseConst.cpp:151`). */
function matrixOfMatrix(size: number, source: Lanes, sourceSize: number): Lanes {
  return Array.from({ length: size * size }, (_, at) => {
    const column = Math.floor(at / size);
    const row = at % size;
    if (column < sourceSize && row < sourceSize) return source[column * sourceSize + row]!;
    return column === row ? 1 : 0;
  });
}

/** `owner[index]` (`foldDereference`): a vector's lane or a matrix's column. */
function element(owner: Lanes, shape: TypeShape, index: number): Lanes | undefined {
  const size = shape.columns === undefined ? 1 : shape.columns;
  if (index < 0 || (index + 1) * size > owner.length) return undefined;
  return owner.slice(index * size, (index + 1) * size);
}

/** glslang sizes the result as the left operand and sets lane 0 alone (`Constant.cpp:101`). */
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

/** Each lane a sum of products in double precision, from the first term on. */
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
