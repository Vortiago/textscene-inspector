/**
 * Godot's evaluation of an operator whose operands' values it knows (`_eval_operator`,
 * `shader_language.cpp:2065`), which `_validate_operator` runs as each operator reduces. It
 * refuses an integer division or modulo by zero, and it ends the process on two shapes, which
 * the transpiler refuses with a message of its own. Only integer lanes decide a verdict, so the
 * other lanes count only for whether a value is known.
 */

import { INT32_MIN } from '../../godot/variant/intWidth.js';
import { binaryLane } from './glslangArithmetic.js';
import type { Expression, OperatorNode, Scalar } from './shaderTree.js';
import { shapeOf } from './types.js';

/** The binary operators Godot evaluates (`shader_language.cpp:2069`). */
const EVALUATED = new Set([
  'OP_EQUAL',
  'OP_NOT_EQUAL',
  'OP_LESS',
  'OP_LESS_EQUAL',
  'OP_GREATER',
  'OP_GREATER_EQUAL',
  'OP_AND',
  'OP_OR',
  'OP_ADD',
  'OP_SUB',
  'OP_MUL',
  'OP_DIV',
  'OP_MOD',
  'OP_SHIFT_LEFT',
  'OP_SHIFT_RIGHT',
  'OP_BIT_AND',
  'OP_BIT_OR',
  'OP_BIT_XOR',
]);

/** A value-known lane list, or nothing for a node whose values Godot does not know. */
type Values = readonly Scalar[] | undefined;

/**
 * Written only by `evaluationOf`: a node does not change once reduced, and an entry goes with its
 * node.
 */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const evaluations = new WeakMap<OperatorNode, Evaluation>();

/** The evaluation of `node`, made once. */
function evaluationOf(node: OperatorNode): Evaluation {
  let evaluation = evaluations.get(node);
  if (evaluation === undefined) evaluations.set(node, (evaluation = evaluated(node)));
  return evaluation;
}

/**
 * The values Godot knows of `node`: a constant's lanes, or an evaluated operator's. A unary
 * operator keeps none but on a `bool`, because Godot compares the lane count with the type's
 * enumerator (`shader_language.cpp:2318`).
 */
function knownValues(node: Expression): Values {
  if (node.kind === 'constant') return node.values;
  return node.kind === 'operator' ? evaluationOf(node).values : undefined;
}

/** The reason Godot refuses `node` for its operands' values, or nothing. */
export const evaluationRefusal = (node: OperatorNode): string | undefined => evaluationOf(node).refusal;

interface Evaluation {
  readonly values: Values;
  readonly refusal?: string;
}

function evaluated(node: OperatorNode): Evaluation {
  if (node.op === 'OP_NOT') {
    const operand = knownValues(node.operands[0]!);
    return { values: operand && node.type === 'bool' ? operand.map((lane) => !lane) : undefined };
  }
  if (!EVALUATED.has(node.op)) return { values: undefined };
  const [left, right] = node.operands.map(knownValues);
  if (left === undefined || right === undefined) return { values: undefined };
  if (isMatrixTransform(node)) return matrixTransform(node);
  return lanewise(node, left, right);
}

/** `vecN * matN` or `matN * vecN`, which Godot evaluates as a product (`shader_language.cpp:2104`). */
function isMatrixTransform({ op, operands }: OperatorNode): boolean {
  if (op !== 'OP_MUL') return false;
  const [left, right] = operands.map((operand) => shapeOf(operand.type)!);
  return left!.columns === right!.lanes || right!.columns === left!.lanes;
}

/**
 * Godot's `mat4 * vec4` reads the vector's lanes as the matrix's, past the vector's last lane
 * (`shader_language.cpp:2401`), which ends the process.
 */
function matrixTransform(node: OperatorNode) {
  if (node.operands[0]!.type === 'mat4')
    return {
      values: undefined,
      refusal: abortMessage('it folds `mat4 * vec4` of constants past the last lane'),
    };
  return { values: Array<Scalar>(shapeOf(node.type)!.lanes).fill(0) };
}

/** `_eval_vector` (`shader_language.cpp:2331`): one lane at a time, a scalar operand repeated. */
function lanewise(node: OperatorNode, left: readonly Scalar[], right: readonly Scalar[]) {
  const values: Scalar[] = [];
  for (let lane = 0; lane < shapeOf(node.type)!.lanes; lane += 1) {
    const a = left[Math.min(lane, left.length - 1)]!;
    const b = right[Math.min(lane, right.length - 1)]!;
    const refusal = laneRefusal(node, a, b);
    if (refusal !== undefined) return { values: undefined, refusal };
    values.push(laneValue(node, a, b));
  }
  return { values };
}

/**
 * `_eval_scalar` (`shader_language.cpp:2159`). Division checks for zero on an `int` type and on
 * the `uint` scalar only, modulo on every integer type. The least `int` over -1 traps the CPU.
 */
function laneRefusal(node: OperatorNode, a: Scalar, b: Scalar): string | undefined {
  if (node.op !== 'OP_DIV' && node.op !== 'OP_MOD') return undefined;
  const scalar = shapeOf(node.type)!.scalar;
  const checksZero =
    scalar === 'int' || (scalar === 'uint' && (node.op === 'OP_MOD' || node.type === 'uint'));
  if (checksZero && b === 0)
    return node.op === 'OP_DIV' ? 'Division by zero error.' : 'Modulo by zero error.';
  if (scalar === 'int' && a === INT32_MIN && b === -1)
    return abortMessage('the least `int` divided by -1 traps the CPU');
  return undefined;
}

/**
 * One lane of an `int` or `uint` result as C++ computes it, the arithmetic glslang folds with. A
 * `uint` vector divides as floats of its bits, the branch Godot takes for it (line 2253). Other
 * lanes only mark a known value.
 */
function laneValue({ op, type }: OperatorNode, a: Scalar, b: Scalar): Scalar {
  const scalar = shapeOf(type)!.scalar;
  if (scalar !== 'int' && scalar !== 'uint') return 0;
  if (op === 'OP_DIV' && scalar === 'uint' && type !== 'uint') return bitsQuotient(a as number, b as number);
  const apply = binaryLane(op, scalar);
  if (!apply) throw new Error(`expected an integer operator, got ${op}`);
  return apply(a, b);
}

/** The bits of the 32-bit float quotient of the floats whose bits are `a` and `b`. */
function bitsQuotient(a: number, b: number): number {
  const lanes = new Uint32Array([a, b]);
  const floats = new Float32Array(lanes.buffer);
  floats[0] = floats[0]! / floats[1]!;
  return lanes[0]!;
}

const abortMessage = (cause: string) =>
  `Godot 4.6.3 aborts on this expression: ${cause}. Godot cannot run this shader.`;
