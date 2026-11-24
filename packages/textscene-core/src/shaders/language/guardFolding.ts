import { isStructValue, type Value } from './emitValue.js';
import type { Lanes } from './glslangCalls.js';
import type { GlslangFolding } from './glslangFolding.js';
import type { Expression, OperatorNode } from './shaderTree.js';
import { isCall } from './treeWalk.js';

/** The value a name has in scope, or nothing. */
export type Lookup = (name: string) => Value | undefined;

/** The lanes of a call of a shader function that rests on literals alone, or nothing. */
export type ConstantCall = (name: string) => Lanes | undefined;

/** A guard that rests on literals, folded through calls: ANGLE drops an `if (false)` but inlines no call. */
export class GuardFolding {
  constructor(
    private readonly folding: GlslangFolding,
    private readonly lookup: Lookup,
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
    if (expression.kind !== 'operator' || expression.row.id === 'OP_CALL') return expression;
    const operands = expression.operands.map((operand) => this.withLiterals(operand));
    const isUnchanged = operands.every((operand, index) => operand === expression.operands[index]);
    return isUnchanged ? expression : { ...expression, operands };
  }

  private literalLanes(expression: Expression): Lanes | undefined {
    if (expression.kind === 'variable' || expression.kind === 'field')
      return constantLanes(this.valueAt(expression));
    if (!isCall(expression) || expression.row.id !== 'OP_CALL') return undefined;
    return expression.operands.length === 0 ? this.constantCall(expression.function) : undefined;
  }

  /** The value of a name or of a struct member read through one: `implementation_data_block.data.x`. */
  private valueAt(expression: Expression): Value | undefined {
    if (expression.kind === 'variable') return this.lookup(expression.name);
    if (expression.kind !== 'field') return undefined;
    const owner = this.valueAt(expression.owner);
    return owner && isStructValue(owner) ? owner.members.get(expression.name) : undefined;
  }
}

/** A literal node's lanes: three's `ConstNode` holds its value as `value`. */
function constantLanes(value: Value | undefined): Lanes | undefined {
  const node = value as { isConstNode?: boolean; value?: unknown } | undefined;
  if (!node?.isConstNode) return undefined;
  const literal = node.value;
  return typeof literal === 'number' || typeof literal === 'boolean' ? [literal] : undefined;
}
