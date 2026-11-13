/**
 * The emitter: the typed tree to three.js TSL nodes. Each node of the tree becomes the TSL node of
 * the same GLSL operation, so the GPU computes what Godot's GLSL computes. TSL nodes hold no
 * state, so the emitter keeps each argument's current value and writes an assignment there.
 */

import { select } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { CONSTRUCTORS, constantNode } from './emitConstant.js';
import { assignedOperator, columnOf, constructed, OPERATIONS } from './emitOperation.js';
import { GlslangFolding } from './glslangFolding.js';
import { glslExpression } from './godotText.js';
import { isAssignOperator } from './operators.js';
import type { Argument, Expression, FunctionNode, OperatorNode, Statement, ValueType } from './shaderTree.js';
import { swizzleLanes } from './swizzle.js';
import { shapeOf } from './types.js';

/** A function of the shader as TSL: `call` builds its result from one node per argument. */
export interface TranspiledFunction {
  readonly name: string;
  readonly returnType: ValueType;
  readonly arguments: readonly Argument[];
  call(args: readonly Node[]): Node;
}

/** `definition` as TSL. The tree holds only rows the transpiler transpiles (`checkTranspiled`). */
export function emitFunction(definition: FunctionNode): TranspiledFunction {
  const folding = new GlslangFolding();
  const statements = definition.body.statements.map(glslStatement);
  return {
    name: definition.name,
    returnType: definition.returnType,
    arguments: definition.arguments,
    call(args) {
      if (args.length !== definition.arguments.length) {
        throw new Error(
          `expected ${definition.arguments.length} arguments for ${definition.name}, got ${args.length}`
        );
      }
      const values = new Map(definition.arguments.map((argument, index) => [argument.name, args[index]!]));
      return new FunctionEmitter(values, folding).returned(statements);
    },
  };
}

/** The statement GLSL reads from Godot's text of `statement`. */
function glslStatement(statement: Statement): Statement {
  if (statement.kind !== 'control flow') return glslExpression(statement);
  return { ...statement, expressions: statement.expressions.map(glslExpression) };
}

/** A place an assignment writes: an argument, a swizzle of a place, or an element of a place. */
interface Place {
  read(): Node;
  write(value: Node): void;
}

const LANE_LETTERS = 'xyzw';

/** The `++` and `--` operators: whether each adds or takes one, and whether it gives the new value. */
const STEPS: Readonly<Record<string, { readonly operator: string; readonly givesNew: boolean }>> = {
  OP_INCREMENT: { operator: 'OP_ADD', givesNew: true },
  OP_DECREMENT: { operator: 'OP_SUB', givesNew: true },
  OP_POST_INCREMENT: { operator: 'OP_ADD', givesNew: false },
  OP_POST_DECREMENT: { operator: 'OP_SUB', givesNew: false },
};

/** One call of a function: its arguments' current values, which its assignments change. */
class FunctionEmitter {
  constructor(
    private values: Map<string, Node>,
    private readonly folding: GlslangFolding
  ) {}

  /** The value of the first `return`, after the statements before it: the statements after it never run. */
  returned(statements: readonly Statement[]): Node {
    for (const statement of statements) {
      if (statement.kind === 'control flow') return this.emit(statement.expressions[0]!);
      if (statement.kind !== 'operator' || statement.op !== 'OP_EMPTY') this.emit(statement);
    }
    throw new Error('expected a return statement in a function that returns a value');
  }

  private emit(expression: Expression): Node {
    const folded = this.folding.lanesOf(expression);
    if (folded) return constantNode(expression.type, folded);
    switch (expression.kind) {
      case 'constant':
        return constantNode(expression.type, expression.values);
      case 'variable':
        return this.values.get(expression.name)!;
      case 'member':
        return swizzle(this.emit(expression.owner), swizzleLanes(expression));
      case 'operator':
        return this.operator(expression);
    }
  }

  private operator(expression: OperatorNode): Node {
    const { op, operands } = expression;
    if (op === 'OP_CONSTRUCT')
      return constructed(
        expression.type,
        operands.map((operand) => this.emit(operand)),
        operands.map((operand) => operand.type)
      );
    if (op === 'OP_SELECT_IF') return this.selected(operands);
    if (op === 'OP_AND') return this.both(operands);
    if (op === 'OP_OR') return this.either(operands);
    if (op === 'OP_INDEX') return element(this.emit(operands[0]!), this.emit(operands[1]!));
    if (isAssignOperator(op)) return this.assigned(expression);
    if (STEPS[op]) return this.stepped(expression);
    return this.applied(
      op,
      operands.map((operand) => this.emit(operand)),
      operands.map((operand) => operand.type)
    );
  }

  private applied(op: string, operands: readonly Node[], types: readonly ValueType[]): Node {
    return OPERATIONS[op]!(operands, types);
  }

  /** `condition ? then : else`: GLSL runs one side, so each argument takes the value of the side that ran. */
  private selected([condition, then, otherwise]: readonly Expression[]): Node {
    const test = this.emit(condition!);
    return this.branched(
      test,
      () => this.emit(then!),
      () => this.emit(otherwise!)
    );
  }

  /** `a && b`: GLSL runs `b` only when `a` holds. */
  private both([first, second]: readonly Expression[]): Node {
    const test = this.emit(first!);
    return this.branched(
      test,
      () => this.emit(second!),
      () => constantNode('bool', [false])
    );
  }

  /** `a || b`: GLSL runs `b` only when `a` does not hold. */
  private either([first, second]: readonly Expression[]): Node {
    const test = this.emit(first!);
    return this.branched(
      test,
      () => constantNode('bool', [true]),
      () => this.emit(second!)
    );
  }

  /** The value of the side `test` picks, and each argument's value after that side. */
  private branched(test: Node, whenTrue: () => Node, whenFalse: () => Node): Node {
    const before = this.values;
    this.values = new Map(before);
    const trueValue = whenTrue();
    const afterTrue = this.values;
    this.values = new Map(before);
    const falseValue = whenFalse();
    const afterFalse = this.values;
    this.values = new Map(
      [...before.keys()].map((name) => {
        const [onTrue, onFalse] = [afterTrue.get(name)!, afterFalse.get(name)!];
        return [name, onTrue === onFalse ? onTrue : choose(test, onTrue, onFalse)];
      })
    );
    return choose(test, trueValue, falseValue);
  }

  /** `a = b` or `a op= b`: the target's places first, then `b`, then the target's value as `b` left it. */
  private assigned(expression: OperatorNode): Node {
    const [target, source] = expression.operands as [Expression, Expression];
    const place = this.place(target);
    const value = this.emit(source);
    const operator = assignedOperator(expression.op);
    const result =
      operator === undefined
        ? value
        : this.applied(operator, [place.read(), value], [target.type, source.type]);
    place.write(result);
    return place.read();
  }

  /** `++a`, `--a`, `a++` and `a--`: one of the target's type added or taken. */
  private stepped(expression: OperatorNode): Node {
    const target = expression.operands[0]!;
    const step = STEPS[expression.op]!;
    const place = this.place(target);
    const old = place.read();
    const one = constantNode(shapeOf(target.type)!.scalar, [1]);
    place.write(this.applied(step.operator, [old, one], [target.type, shapeOf(target.type)!.scalar]));
    return step.givesNew ? place.read() : old;
  }

  /** The place `target` names. Godot assigns only to an argument, its swizzles and its elements. */
  private place(target: Expression): Place {
    if (target.kind === 'variable') {
      return {
        read: () => this.values.get(target.name)!,
        write: (value) => this.values.set(target.name, value),
      };
    }
    if (target.kind === 'member') {
      const owner = this.place(target.owner);
      const lanes = swizzleLanes(target);
      return {
        read: () => swizzle(owner.read(), lanes),
        write: (value) => owner.write(withLanes(owner.read(), target.owner.type, lanes, value)),
      };
    }
    if (target.kind === 'operator' && target.op === 'OP_INDEX') {
      const owner = this.place(target.operands[0]!);
      const index = target.operands[1]!;
      const indexNode = this.emit(index);
      return {
        read: () => element(owner.read(), indexNode),
        write: (value) =>
          owner.write(withElement(owner.read(), target.operands[0]!.type, index, indexNode, value)),
      };
    }
    throw new Error(`expected an argument, a swizzle or an element to assign to, got a ${target.kind}`);
  }
}

const choose = (test: Node, onTrue: Node, onFalse: Node) =>
  (select as unknown as (...operands: Node[]) => Node)(test, onTrue, onFalse);

const swizzle = (owner: Node, lanes: readonly number[]) =>
  (owner as unknown as Record<string, Node>)[lanes.map((lane) => LANE_LETTERS[lane]).join('')]!;

const element = (owner: Node, index: Node) =>
  (owner as unknown as { element(index: Node): Node }).element(index);

/** Lane `lane` of a value of `lanes` lanes: a scalar is its own one lane. */
const laneOf = (value: Node, lanes: number, lane: number) => (lanes === 1 ? value : swizzle(value, [lane]));

/** The vector `owner` of type `type` with the lanes `lanes` taken from `value`, one value lane each. */
function withLanes(owner: Node, type: ValueType, lanes: readonly number[], value: Node): Node {
  const count = shapeOf(type)!.lanes;
  const components = Array.from({ length: count }, (_, lane) => {
    const from = lanes.indexOf(lane);
    return from === -1 ? swizzle(owner, [lane]) : laneOf(value, lanes.length, from);
  });
  return CONSTRUCTORS[type]!(...components);
}

/**
 * The vector or matrix `owner` with element `index` replaced by `value`. A constant index picks
 * its element. Another picks each element by comparing, as GLSL reads it at run time.
 */
function withElement(owner: Node, type: ValueType, index: Expression, indexNode: Node, value: Node): Node {
  const shape = shapeOf(type)!;
  const count = shape.columns ?? shape.lanes;
  const current = (position: number) =>
    shape.columns === undefined ? swizzle(owner, [position]) : columnOf(owner, position);
  const elements = Array.from({ length: count }, (_, position) => {
    if (index.kind === 'constant') return index.values[0] === position ? value : current(position);
    const isPicked = OPERATIONS.OP_EQUAL!([indexNode, constantNode(index.type, [position])], [index.type]);
    return choose(isPicked, value, current(position));
  });
  return CONSTRUCTORS[type]!(...elements);
}
