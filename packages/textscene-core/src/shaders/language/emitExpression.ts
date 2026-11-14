/**
 * The TSL value of an expression of the lowered tree, a plain walk. A variable is a TSL `Var`, so
 * a read gives the value at the place TSL writes it. The tree orders every write already: no
 * part is read after a later part writes it, and no `?:`, `&&` or `||` holds a write
 * (`lowering/lowerSideEffects.ts`).
 */

import { select } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { constantNode } from './emitConstant.js';
import { assignedOperator, constructed, element, OPERATIONS } from './emitOperation.js';
import type { EmitScope } from './emitScope.js';
import {
  copyInto,
  declareVariables,
  isArrayValue,
  isStructValue,
  inVar,
  type StructOf,
  type Value,
  variablesOf,
} from './emitValue.js';
import type { GlslangFolding } from './glslangFolding.js';
import { isAssignOperator } from './operators.js';
import { STEPS } from './assignment.js';
import { arraySizeOf } from './parseExpression.js';
import type { Expression, OperatorNode } from './shaderTree.js';
import { swizzleLanes } from './swizzle.js';
import { shapeOf } from './types.js';

const LANE_LETTERS = 'xyzw';

export class ExpressionEmitter {
  constructor(
    private readonly scope: EmitScope,
    private readonly folding: GlslangFolding,
    private readonly structOf: StructOf
  ) {}

  /** The node of an expression of a value type. */
  node(expression: Expression): Node {
    return this.value(expression) as Node;
  }

  value(expression: Expression): Value {
    const folded = this.folding.lanesOf(expression);
    if (folded) return constantNode(expression.type, folded);
    switch (expression.kind) {
      case 'constant':
        return constantNode(expression.type, expression.values);
      case 'variable':
        return this.scope.find(expression.name);
      case 'member':
        return swizzle(this.node(expression.owner), swizzleLanes(expression));
      case 'field': {
        const owner = this.value(expression.owner);
        if (!isStructValue(owner)) throw new Error(`expected a struct to read .${expression.name} of`);
        return owner.members.get(expression.name)!;
      }
      case 'array element':
        return this.arrayElement(expression.array, expression.index);
      case 'array construct':
        // Kept in new variables, so no later write changes an element read here.
        return variablesOf(
          {
            kind: 'array',
            count: expression.arraySize,
            element: (index) => this.value(expression.elements[index as number]!),
          },
          expression.type,
          expression.arraySize,
          this.structOf
        );
      case 'array length':
        return constantNode('int', [arraySizeOf(expression.array)]);
      case 'whole assign': {
        const target = this.value(expression.target);
        copyInto(target, this.value(expression.value));
        return target;
      }
      case 'operator':
        return this.operator(expression);
    }
  }

  private arrayElement(arrayExpression: Expression, index: Expression): Value {
    const owner = this.value(arrayExpression);
    if (!isArrayValue(owner)) throw new Error('expected an array to index');
    const lane = this.folding.lanesOf(index)?.[0];
    return owner.element(lane === undefined ? this.node(index) : (lane as number) | 0);
  }

  private operator(expression: OperatorNode): Value {
    const { op, operands } = expression;
    if (op === 'OP_STRUCT') return this.structConstruct(expression);
    if (op === 'OP_SELECT_IF') return this.selected(expression);
    if (op === 'OP_AND' || op === 'OP_OR') return this.shortCircuit(expression);
    if (isAssignOperator(op)) return this.assigned(expression);
    if (STEPS[op]) return this.stepped(expression);
    const nodes = operands.map((operand) => this.node(operand));
    const types = operands.map((operand) => operand.type);
    if (op === 'OP_CONSTRUCT') return constructed(expression.type, nodes, types);
    if (op === 'OP_INDEX') return element(nodes[0]!, nodes[1]!);
    return OPERATIONS[op]!(nodes, types);
  }

  /** `Pair(a, b)`: each member's value, kept in the struct's own variables. */
  private structConstruct(expression: OperatorNode): Value {
    const struct = this.structOf(expression.type)!;
    const variables = declareVariables(expression.type, 0, this.structOf);
    if (!isStructValue(variables)) throw new Error(`expected the struct ${struct.name}`);
    struct.members.forEach((member, index) =>
      copyInto(variables.members.get(member.name)!, this.value(expression.operands[index]!))
    );
    return variables;
  }

  /** `c ? a : b`: neither side writes, so both run and `select` picks one. */
  private selected({ operands }: OperatorNode): Node {
    const [condition, then, otherwise] = operands.map((operand) => this.node(operand)) as [Node, Node, Node];
    return choose(condition, then, otherwise);
  }

  /** `a && b` and `a || b`: `b` writes nothing, so it runs whatever `a` decides. */
  private shortCircuit({ op, operands }: OperatorNode): Node {
    const [test, second] = operands.map((operand) => this.node(operand)) as [Node, Node];
    const decided = constantNode('bool', [op === 'OP_OR']);
    return op === 'OP_AND' ? choose(test, second, decided) : choose(test, decided, second);
  }

  /** `a = b` or `a op= b`. The target is a fresh node at each read, so no node is read twice. */
  private assigned(expression: OperatorNode): Node {
    const [target, source] = expression.operands as [Expression, Expression];
    const value = this.node(source);
    const operator = assignedOperator(expression.op);
    const result =
      operator === undefined
        ? value
        : OPERATIONS[operator]!([this.node(target), value], [target.type, source.type]);
    this.node(target).assign(result);
    return this.node(target);
  }

  /** `++a`, `--a`, `a++` and `a--`: one of the target's type added or taken. */
  private stepped(expression: OperatorNode): Node {
    const target = expression.operands[0]!;
    const step = STEPS[expression.op]!;
    const old = inVar(this.node(target));
    const scalar = shapeOf(target.type)!.scalar;
    this.node(target).assign(
      OPERATIONS[step.operator]!([old, constantNode(scalar, [1])], [target.type, scalar])
    );
    return step.givesNew ? this.node(target) : old;
  }
}

const choose = (test: Node, onTrue: Node, onFalse: Node) =>
  (select as unknown as (...operands: Node[]) => Node)(test, onTrue, onFalse);

const swizzle = (owner: Node, lanes: readonly number[]) =>
  (owner as unknown as Record<string, Node>)[lanes.map((lane) => LANE_LETTERS[lane]).join('')]!;
