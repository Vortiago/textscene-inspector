/**
 * Two facts of the GLSL Godot draws with that the tree alone does not show: the negation Godot's
 * compiler leaves out of its text, and the constants its GLSL compiler, glslang, folds. The
 * emitter follows both, so the GPU computes what Godot's GLSL computes.
 */

import { godotConstantDouble } from './godotNumber.js';
import { operatorOfRow } from './operators.js';
import type { Expression, OperatorApplication } from './shaderTree.js';

const isNegation = (expression: Expression) =>
  expression.kind === 'operator' && operatorOfRow(expression.row.id) === 'OP_NEGATE';

/**
 * Whether Godot's text of `expression` starts with `-`. A swizzle's text starts with its base's,
 * and a constant's with its sign.
 */
function textStartsWithMinus(expression: Expression): boolean {
  if (isNegation(expression)) return true;
  if (expression.kind === 'swizzle') return textStartsWithMinus(expression.base);
  return expression.kind === 'constant' && expression.type === 'float' && signBit(expression.values[0]!);
}

const signBit = (value: number) => value < 0 || Object.is(value, -0);

/**
 * Whether Godot writes the negation `negation` as its operand alone: it does when the operand's
 * text starts with `-` (`shader_compiler.cpp:1141`), so `-(-a)` draws as `-a`.
 */
export function dropsNegation(negation: OperatorApplication): boolean {
  return textStartsWithMinus(negation.operands[0]!);
}

/**
 * The lanes of each expression glslang folds to a constant, or nothing for one that reads a
 * parameter. glslang reads each constant of Godot's text as a double, folds the arithmetic of
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
        return expression.values.map(godotConstantDouble);
      case 'parameter':
        return undefined;
      case 'swizzle': {
        const base = this.lanesOf(expression.base);
        return base && expression.lanes.map((lane) => base[lane]!);
      }
      case 'constructor': {
        const args = expression.args.map((arg) => this.lanesOf(arg));
        if (!args.every((arg) => arg !== undefined)) return undefined;
        const lanes = args.flat();
        return lanes.length === 1 ? Array(laneCountOf(expression.type)).fill(lanes[0]) : lanes;
      }
      case 'operator':
        return this.foldOperator(expression);
    }
  }

  private foldOperator(expression: OperatorApplication): readonly number[] | undefined {
    const operands = expression.operands.map((operand) => this.lanesOf(operand));
    if (!operands.every((operand) => operand !== undefined)) return undefined;
    const op = operatorOfRow(expression.row.id);
    if (op === 'OP_NEGATE')
      return dropsNegation(expression) ? operands[0] : operands[0]!.map((lane) => -lane);
    const [left, right] = operands as [readonly number[], readonly number[]];
    const apply = DOUBLE_OPERATIONS[op];
    return Array.from({ length: Math.max(left.length, right.length) }, (_, lane) =>
      apply(laneAt(left, lane), laneAt(right, lane))
    );
  }
}

/** A scalar operand stands for every lane of a vector one. */
const laneAt = (lanes: readonly number[], lane: number) => lanes[lanes.length === 1 ? 0 : lane]!;

const laneCountOf = (type: string) => (type === 'float' ? 1 : Number(type.slice(3)));

const DOUBLE_OPERATIONS: Readonly<
  Record<'OP_ADD' | 'OP_SUB' | 'OP_MUL' | 'OP_DIV', (a: number, b: number) => number>
> = {
  OP_ADD: (a, b) => a + b,
  OP_SUB: (a, b) => a - b,
  OP_MUL: (a, b) => a * b,
  OP_DIV: (a, b) => a / b,
};
