/**
 * Two facts of the GLSL Godot draws with that the tree alone does not show: the negation Godot's
 * compiler leaves out of its text, and the constants its GLSL compiler, glslang, folds. The
 * emitter follows both, so the GPU computes what Godot's GLSL computes.
 */

import { godotConstantDouble } from './godotNumber.js';
import type { Expression, OperatorNode } from './shaderTree.js';
import { swizzleLanes } from './swizzle.js';
import { shapeOf } from './types.js';

const isNegation = (expression: Expression) =>
  expression.kind === 'operator' && expression.op === 'OP_NEGATE';

/**
 * Whether Godot's text of `expression` starts with `-`. A swizzle's text starts with its owner's,
 * and a scalar float constant's with its sign. A vector constant's text starts with its type.
 */
function textStartsWithMinus(expression: Expression): boolean {
  if (isNegation(expression)) return true;
  if (expression.kind === 'member') return textStartsWithMinus(expression.owner);
  return (
    expression.kind === 'constant' && expression.type === 'float' && signBit(expression.values[0] as number)
  );
}

const signBit = (value: number) => value < 0 || Object.is(value, -0);

/**
 * Whether Godot writes the negation `negation` as its operand alone: it does when the operand's
 * text starts with `-` (`shader_compiler.cpp:1141`), so `-(-a)` draws as `-a`.
 */
export function dropsNegation(negation: OperatorNode): boolean {
  return textStartsWithMinus(negation.operands[0]!);
}

/**
 * The lanes of each expression glslang folds to a constant, or nothing for one that reads an
 * argument. glslang reads each constant of Godot's text as a double, folds the arithmetic of
 * constants in double precision, and rounds once, when it writes the SPIR-V constant. A fold in
 * 32-bit floats lands one unit off: `58.656 + 74.377` is 0x43050873 in Godot, 0x43050872 so.
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
    if (expression.op === 'OP_NEGATE') {
      return dropsNegation(expression) ? operands[0] : operands[0]!.map((lane) => -lane);
    }
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
