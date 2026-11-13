/**
 * The constants Godot's GLSL compiler, glslang, folds, which the tree alone does not show. The
 * emitter writes each folded constant, so the GPU reads what Godot's GLSL holds.
 */

import { godotConstantDouble } from './godotNumber.js';
import type { Expression, OperatorNode } from './shaderTree.js';
import { swizzleLanes } from './swizzle.js';
import { shapeOf } from './types.js';

/**
 * The lanes of each float scalar or vector expression glslang folds to a constant, or nothing for
 * one that reads an argument or holds another type. glslang reads Godot's float constants as
 * doubles, folds in double precision and rounds once. A fold in 32-bit floats lands one unit off:
 * `58.656 + 74.377` is 0x43050873 in Godot, 0x43050872 so.
 */
export class GlslangFolding {
  /** Filled by `lanesOf` as it walks a function's tree, which never changes. */
  private readonly lanes = new WeakMap<Expression, readonly number[] | null>();

  lanesOf(expression: Expression): readonly number[] | undefined {
    let lanes = this.lanes.get(expression);
    if (lanes === undefined) {
      lanes = this.fold(expression) ?? null;
      this.lanes.set(expression, lanes);
    }
    return lanes ?? undefined;
  }

  private fold(expression: Expression): readonly number[] | undefined {
    const shape = shapeOf(expression.type);
    if (shape?.scalar !== 'float' || shape.columns !== undefined) return undefined;
    switch (expression.kind) {
      case 'constant':
        return expression.values.map((value) => godotConstantDouble(value as number));
      case 'variable':
        return undefined;
      case 'member': {
        const owner = this.lanesOf(expression.owner);
        return owner && swizzleLanes(expression).map((lane) => owner[lane]!);
      }
      case 'operator':
        return this.foldOperator(expression);
    }
  }

  private foldOperator(expression: OperatorNode): readonly number[] | undefined {
    const operands = expression.operands.map((operand) => this.lanesOf(operand));
    if (!operands.every((operand) => operand !== undefined)) return undefined;
    if (expression.op === 'OP_CONSTRUCT') {
      const lanes = operands.flat();
      return lanes.length === 1 ? Array<number>(shapeOf(expression.type)!.lanes).fill(lanes[0]!) : lanes;
    }
    if (expression.op === 'OP_NEGATE') return operands[0]!.map((lane) => -lane);
    const apply = DOUBLE_OPERATIONS[expression.op];
    if (!apply) return undefined;
    const [left, right] = operands as [readonly number[], readonly number[]];
    return Array.from({ length: Math.max(left.length, right.length) }, (_, lane) =>
      apply(laneAt(left, lane), laneAt(right, lane))
    );
  }
}

/** A scalar operand stands for every lane of a vector one. */
const laneAt = (lanes: readonly number[], lane: number) => lanes[lanes.length === 1 ? 0 : lane]!;

const DOUBLE_OPERATIONS: Readonly<Record<string, (a: number, b: number) => number>> = {
  OP_ADD: (a, b) => a + b,
  OP_SUB: (a, b) => a - b,
  OP_MUL: (a, b) => a * b,
  OP_DIV: (a, b) => a / b,
};
