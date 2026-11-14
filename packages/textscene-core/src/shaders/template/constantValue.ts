/**
 * The value of a constant integer expression of a template, as an array size or a layout value
 * needs it (GLSL 4.50 section 4.3.3): literals, `const` variables and the integer operators.
 * Nothing when the expression is not constant.
 */

import type { Expression, Scalar } from '../language/shaderTree.js';

/** The lanes of a `const` variable by its name, as the scope knows them. */
export type ConstantLookup = (name: string) => readonly Scalar[] | undefined;

const INTEGER_OPS: Readonly<Record<string, (a: number, b: number) => number>> = {
  OP_ADD: (a, b) => a + b,
  OP_SUB: (a, b) => a - b,
  OP_MUL: (a, b) => Math.imul(a, b),
  OP_DIV: (a, b) => Math.trunc(a / b),
  OP_MOD: (a, b) => a % b,
  OP_SHIFT_LEFT: (a, b) => a << b,
  OP_SHIFT_RIGHT: (a, b) => a >> b,
  OP_BIT_AND: (a, b) => a & b,
  OP_BIT_OR: (a, b) => a | b,
  OP_BIT_XOR: (a, b) => a ^ b,
};

/** The one lane of `expression` when it is a constant scalar, or nothing. */
export function constantScalar(expression: Expression, lookup: ConstantLookup): Scalar | undefined {
  switch (expression.kind) {
    case 'constant':
      return expression.values.length === 1 ? expression.values[0] : undefined;
    case 'variable': {
      const values = expression.isConst ? lookup(expression.name) : undefined;
      return values?.length === 1 ? values[0] : undefined;
    }
    case 'operator':
      return operatorValue(expression.op, expression.operands, expression.type, lookup);
    default:
      return undefined;
  }
}

function operatorValue(
  op: string,
  operands: readonly Expression[],
  type: string,
  lookup: ConstantLookup
): Scalar | undefined {
  const values = operands.map((operand) => constantScalar(operand, lookup));
  if (values.some((value) => value === undefined)) return undefined;
  const [a, b] = values as Scalar[];
  if (op === 'OP_CONSTRUCT' && values.length === 1) return convertedTo(a!, type);
  if (op === 'OP_NEGATE' && typeof a === 'number') return type === 'float' ? -a : -a | 0;
  const integer = INTEGER_OPS[op];
  if (integer && typeof a === 'number' && typeof b === 'number' && (type === 'int' || type === 'uint')) {
    const value = integer(a, b);
    return type === 'uint' ? value >>> 0 : value | 0;
  }
  return undefined;
}

function convertedTo(value: Scalar, type: string): Scalar | undefined {
  const number = typeof value === 'boolean' ? Number(value) : value;
  if (type === 'int') return Math.trunc(number) | 0;
  if (type === 'uint') return Math.trunc(number) >>> 0;
  if (type === 'float') return Math.fround(number);
  if (type === 'bool') return number !== 0;
  return undefined;
}
