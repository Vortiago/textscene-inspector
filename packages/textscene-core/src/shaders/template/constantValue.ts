/**
 * The value of a constant integer expression of a template, as an array size or a layout value
 * needs it (GLSL 4.50 section 4.3.3): literals, `const` variables and the integer operators.
 * Nothing when the expression is not constant.
 */

import { binaryLane, convertedLane, unaryLane } from '../language/glslangArithmetic.js';
import type { Expression, Scalar } from '../language/shaderTree.js';
import type { ScalarKind } from '../language/types.js';

/** The lanes of a `const` variable by its name, as the scope knows them. */
export type ConstantLookup = (name: string) => readonly Scalar[] | undefined;

const SCALAR_KINDS: ReadonlySet<string> = new Set(['bool', 'int', 'uint', 'float']);

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
  const from = operands[0]?.type;
  if (!SCALAR_KINDS.has(type) || !from || !SCALAR_KINDS.has(from)) return undefined;
  const [a, b] = values as Scalar[];
  if (op === 'OP_CONSTRUCT' && values.length === 1)
    return convertedLane(a!, from as ScalarKind, type as ScalarKind);
  if (values.length === 1) return unaryLane(op, type as ScalarKind, a!);
  return binaryLane(op, from as ScalarKind)?.(a!, b!);
}
