/**
 * The TSL value of an expression, in GLSL's order of evaluation. A variable is a TSL `Var`, so a
 * read gives the value at the place TSL writes it. An operand read before another one writes is
 * kept in its own `Var` first, so `a + (a = 3.0)` reads `a` before the write, as GLSL does.
 */

import { If, select } from 'three/tsl';
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
import { arraySizeOf } from './parseExpression.js';
import type { BlockNode, Expression, OperatorNode, ValueType } from './shaderTree.js';
import { swizzleLanes } from './swizzle.js';
import { everyExpression, everyExpressionIn, subExpressions } from './treeWalk.js';
import { filledLanes, shapeOf } from './types.js';

const LANE_LETTERS = 'xyzw';

/** The `++` and `--` operators: whether each adds or takes one, and whether it gives the new value. */
const STEPS: Readonly<Record<string, { readonly operator: string; readonly givesNew: boolean }>> = {
  OP_INCREMENT: { operator: 'OP_ADD', givesNew: true },
  OP_DECREMENT: { operator: 'OP_SUB', givesNew: true },
  OP_POST_INCREMENT: { operator: 'OP_ADD', givesNew: false },
  OP_POST_DECREMENT: { operator: 'OP_SUB', givesNew: false },
};

// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const writing = new WeakMap<Expression, boolean>();

/** Whether `expression` writes a variable: an assignment or a step anywhere in it, found once per node. */
function writes(expression: Expression): boolean {
  let isWriting = writing.get(expression);
  if (isWriting === undefined) {
    isWriting = writtenTarget(expression) !== undefined || subExpressions(expression).some(writes);
    writing.set(expression, isWriting);
  }
  return isWriting;
}

/** The variables a block writes: the name at the root of each target it assigns or steps. */
export function writtenNames(block: BlockNode): Set<string> {
  const names = new Set<string>();
  for (const part of everyExpressionIn(block)) {
    const target = writtenTarget(part);
    if (target) names.add(rootName(target));
  }
  return names;
}

function writtenTarget(expression: Expression): Expression | undefined {
  if (expression.kind === 'whole assign') return expression.target;
  if (expression.kind === 'operator' && (isAssignOperator(expression.op) || STEPS[expression.op]))
    return expression.operands[0];
  return undefined;
}

/** The variable a place is part of: `a` of `a.x[1]`. */
function rootName(target: Expression): string {
  switch (target.kind) {
    case 'variable':
      return target.name;
    case 'member':
    case 'field':
      return rootName(target.owner);
    case 'array element':
      return rootName(target.array);
    case 'operator':
      return rootName(target.operands[target.op === 'OP_INDEX' ? 0 : 1]!);
    default:
      throw new Error(`expected a place to write, got a ${target.kind}`);
  }
}

export class ExpressionEmitter {
  /** The index of a place that writes, kept in a `Var` so a compound assignment runs it once. */
  private readonly keptIndices = new Map<Expression, Node>();

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
    const kept = this.keptIndices.get(expression);
    if (kept) return kept;
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
        const target = this.place(expression.target)();
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
    const nodes = this.operands(operands);
    const types = operands.map((operand) => operand.type);
    if (op === 'OP_CONSTRUCT') return constructed(expression.type, nodes, types);
    if (op === 'OP_INDEX') return element(nodes[0]!, nodes[1]!);
    return OPERATIONS[op]!(nodes, types);
  }

  /** Each operand in order. Before an operand that writes, the values read so far are kept. */
  private operands(operands: readonly Expression[]): Node[] {
    let nodes: Node[] = [];
    for (const operand of operands) {
      if (nodes.length > 0 && writes(operand)) nodes = nodes.map((node) => inVar(node));
      nodes.push(this.node(operand));
    }
    return nodes;
  }

  /** `Pair(a, b)`: each member's value in order, kept in the struct's own variables. */
  private structConstruct(expression: OperatorNode): Value {
    const struct = this.structOf(expression.type)!;
    const variables = declareVariables(expression.type, 0, this.structOf);
    if (!isStructValue(variables)) throw new Error(`expected the struct ${struct.name}`);
    const values = expression.operands.map((operand) => this.value(operand));
    struct.members.forEach((member, index) => copyInto(variables.members.get(member.name)!, values[index]!));
    return variables;
  }

  /** `c ? a : b`: a `select`, or an `If` when a side writes, since GLSL runs one side. */
  private selected({ operands, type }: OperatorNode): Node {
    const [condition, then, otherwise] = operands as [Expression, Expression, Expression];
    const test = this.node(condition);
    if (!writes(then) && !writes(otherwise)) return choose(test, this.node(then), this.node(otherwise));
    return this.branched(type, test, then, otherwise);
  }

  /** `a && b` and `a || b`: GLSL runs `b` only when `a` does not decide. */
  private shortCircuit({ op, operands }: OperatorNode): Node {
    const [first, second] = operands as [Expression, Expression];
    const test = this.node(first);
    const decided = constantNode('bool', [op === 'OP_OR']);
    if (!writes(second))
      return op === 'OP_AND'
        ? choose(test, this.node(second), decided)
        : choose(test, decided, this.node(second));
    const result = inVar(test);
    const run = op === 'OP_AND' ? result : OPERATIONS.OP_NOT!([result], ['bool']);
    If(run as never, this.assignedIn(result, second));
    return result;
  }

  /** The side `test` picks, run in an `If` and kept in a `Var`. */
  private branched(type: ValueType, test: Node, then: Expression, otherwise: Expression): Node {
    const result = inVar(constantNode(type, filledLanes(0, type)));
    If(test as never, this.assignedIn(result, then)).Else(this.assignedIn(result, otherwise));
    return result;
  }

  /** A TSL body that writes `part` into `result`. TSL builds it later, so it reads a copy of the scope here. */
  private assignedIn(result: Node, part: Expression): () => void {
    const scope = this.scope.child();
    return () => {
      result.assign(new ExpressionEmitter(scope, this.folding, this.structOf).node(part));
    };
  }

  /** `a = b` or `a op= b`: the target's indices first, then `b`, then the target's value. */
  private assigned(expression: OperatorNode): Node {
    const [target, source] = expression.operands as [Expression, Expression];
    const place = this.place(target);
    const value = this.node(source);
    const operator = assignedOperator(expression.op);
    const result =
      operator === undefined
        ? value
        : OPERATIONS[operator]!([place() as Node, value], [target.type, source.type]);
    (place() as Node).assign(result);
    return place() as Node;
  }

  /** `++a`, `--a`, `a++` and `a--`: one of the target's type added or taken. */
  private stepped(expression: OperatorNode): Node {
    const target = expression.operands[0]!;
    const step = STEPS[expression.op]!;
    const place = this.place(target);
    const old = inVar(place() as Node);
    const scalar = shapeOf(target.type)!.scalar;
    (place() as Node).assign(
      OPERATIONS[step.operator]!([old, constantNode(scalar, [1])], [target.type, scalar])
    );
    return step.givesNew ? (place() as Node) : old;
  }

  /**
   * The place `target` names, as a function that gives a fresh node of it each call, so no node
   * is read twice. An index that writes runs once, here, and is kept.
   */
  private place(target: Expression): () => Value {
    for (const part of everyExpression(target)) {
      const index =
        part.kind === 'array element'
          ? part.index
          : part.kind === 'operator' && part.op === 'OP_INDEX'
            ? part.operands[1]
            : undefined;
      if (index && writes(index) && !this.keptIndices.has(index))
        this.keptIndices.set(index, inVar(this.node(index)));
    }
    return () => this.value(target);
  }
}

const choose = (test: Node, onTrue: Node, onFalse: Node) =>
  (select as unknown as (...operands: Node[]) => Node)(test, onTrue, onFalse);

const swizzle = (owner: Node, lanes: readonly number[]) =>
  (owner as unknown as Record<string, Node>)[lanes.map((lane) => LANE_LETTERS[lane]).join('')]!;
