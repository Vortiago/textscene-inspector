import type { Value } from './emitValue.js';
import type { Lanes } from './glslangCalls.js';
import type { GlslangFolding } from './glslangFolding.js';
import type { Expression, OperatorNode } from './shaderTree.js';
import { isCall } from './treeWalk.js';

/** A name's value where it is a literal: a specialisation constant, which the emitter folds (ADR-0088). */
export type LiteralOf = (name: string) => Lanes | undefined;

/** The lanes of a call of a shader function that rests on literals alone, or nothing. */
export type ConstantCall = (name: string) => Lanes | undefined;

/** A guard that rests on literals, folded through calls: ANGLE drops an `if (false)` but inlines no call. */
export class GuardFolding {
  constructor(
    private readonly folding: GlslangFolding,
    private readonly literalOf: LiteralOf,
    private readonly constantCall: ConstantCall
  ) {}

  lanesOf(expression: Expression): Lanes | undefined {
    const folded = this.folding.lanesOf(expression);
    if (folded) return folded;
    if (expression.kind === 'operator' && (expression.op === 'OP_AND' || expression.op === 'OP_OR'))
      return this.shortCircuit(expression);
    const literal = this.withLiterals(expression);
    return literal === expression ? undefined : this.folding.lanesOf(literal);
  }

  /** `a && b` decided by `a` alone, or by both: `b` is never read when `a` decides. */
  private shortCircuit(expression: OperatorNode): Lanes | undefined {
    const [first, second] = expression.operands as [Expression, Expression];
    const decides = expression.op === 'OP_OR';
    const test = this.lanesOf(first);
    if (test === undefined) return undefined;
    if (Boolean(test[0]) === decides) return [decides];
    return this.lanesOf(second);
  }

  /** `expression` with each literal read and constant call as a constant, or `expression` with none. */
  private withLiterals(expression: Expression): Expression {
    const lanes = this.literalLanes(expression);
    if (lanes)
      return { kind: 'constant', type: expression.type, values: lanes, position: expression.position };
    if (expression.kind === 'member') {
      const owner = this.withLiterals(expression.owner);
      return owner === expression.owner ? expression : { ...expression, owner };
    }
    if (expression.kind !== 'operator' || isCall(expression)) return expression;
    const operands = expression.operands.map((operand) => this.withLiterals(operand));
    const isUnchanged = operands.every((operand, index) => operand === expression.operands[index]);
    return isUnchanged ? expression : { ...expression, operands };
  }

  private literalLanes(expression: Expression): Lanes | undefined {
    if (expression.kind === 'variable') return this.literalOf(expression.name);
    if (expression.kind !== 'operator' || !isCall(expression) || expression.row.id !== 'OP_CALL')
      return undefined;
    return expression.operands.length === 0 ? this.constantCall(expression.function) : undefined;
  }
}

/** A literal node's lanes: three's `ConstNode` holds its value as `value`. */
export function literalLanes(value: Value | undefined): Lanes | undefined {
  const node = value as { isConstNode?: boolean; value?: unknown } | undefined;
  if (!node?.isConstNode) return undefined;
  const literal = node.value;
  return typeof literal === 'number' || typeof literal === 'boolean' ? [literal] : undefined;
}
