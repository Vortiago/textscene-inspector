/**
 * The tree check: the facts every tree the parser gives must hold, so a parser change that breaks
 * one fails a test. Every node has a type and a line and column, every row fits its operand types,
 * every name is declared before it is read, in a block that holds the read, and with its type, and
 * every flow statement stands where Godot allows it.
 */

import { assignmentRefusal } from './assignment.js';
import { signatureInstruction } from './instructions.js';
import { isAssignOperator } from './operators.js';
import { arraySizeOf } from './parseExpression.js';
import type {
  BlockNode,
  ConstantNode,
  ControlFlowNode,
  DeclarationNode,
  Expression,
  FunctionNode,
  OperatorNode,
  ShaderNode,
  Statement,
  StructNode,
} from './shaderTree.js';
import { swizzled } from './swizzle.js';
import { elementType, shapeOf } from './types.js';

/** The first fact `shader` breaks, or nothing when it holds them all. */
export function treeFault(shader: ShaderNode): string | undefined {
  for (const definition of shader.functions) {
    const fault = new FunctionCheck(shader.structs, definition).fault();
    if (fault !== undefined) return `${definition.name}: ${fault}`;
  }
  return undefined;
}

/** A name a read may reach: its type and its element count, 0 for one value. */
interface Declared {
  readonly type: string;
  readonly arraySize: number;
}

/** Where a statement stands: the loops and labels around it, which allow `break` and `continue`. */
interface Place {
  readonly isInLoop: boolean;
  readonly isInCase: boolean;
  readonly isSwitchBlock: boolean;
}

const BODY: Place = { isInLoop: false, isInCase: false, isSwitchBlock: false };

/** The first value of `items` that `check` gives, or nothing. */
function firstFault<T>(
  items: readonly T[],
  check: (item: T, index: number) => string | undefined
): string | undefined {
  for (const [index, item] of items.entries()) {
    const fault = check(item, index);
    if (fault !== undefined) return fault;
  }
  return undefined;
}

class FunctionCheck {
  /** The blocks from the body in to the current one, each with the names it declares so far. */
  private readonly scopes: Map<string, Declared>[] = [];

  constructor(
    private readonly structs: readonly StructNode[],
    private readonly definition: FunctionNode
  ) {}

  fault(): string | undefined {
    const args = new Map(
      this.definition.arguments.map((argument) => [argument.name, { type: argument.type, arraySize: 0 }])
    );
    this.scopes.push(args);
    return this.block(this.definition.body, BODY);
  }

  private block(block: BlockNode, place: Place): string | undefined {
    this.scopes.push(new Map());
    try {
      return firstFault(block.statements, (statement) => this.statement(statement, place));
    } finally {
      this.scopes.pop();
    }
  }

  private statement(statement: Statement, place: Place): string | undefined {
    const isLabel = statement.kind === 'control flow' && /^FLOW_OP_(CASE|DEFAULT)$/.test(statement.flow);
    if (place.isSwitchBlock !== isLabel) return `a ${statementName(statement)} where a switch holds labels`;
    switch (statement.kind) {
      case 'block':
        return this.block(statement, place);
      case 'declaration':
        return this.declaration(statement);
      case 'control flow':
        return this.flow(statement, place);
      default:
        return isEmpty(statement) ? undefined : this.expression(statement);
    }
  }

  private declaration(declaration: DeclarationNode): string | undefined {
    if (!this.isType(declaration.type)) return `a declaration of type ${declaration.type}`;
    const scope = this.scopes.at(-1)!;
    // The body's names and the arguments share one scope, as Godot looks them up.
    const isBody = this.scopes.length === 2;
    return firstFault(declaration.declarators, (declarator) => {
      if (scope.has(declarator.name) || (isBody && this.scopes[0]!.has(declarator.name)))
        return `a second ${declarator.name} in one block`;
      const arraySize = declarator.arraySize ?? 0;
      if (declarator.value) {
        const fault = this.expression(declarator.value);
        if (fault !== undefined) return fault;
        if (declarator.value.type !== declaration.type || arraySizeOf(declarator.value) !== arraySize)
          return `the value of ${declarator.name} of type ${declarator.value.type}`;
      } else if (declaration.isConst) {
        return `the constant ${declarator.name} with no value`;
      }
      scope.set(declarator.name, { type: declaration.type, arraySize });
      return undefined;
    });
  }

  private flow(flow: ControlFlowNode, place: Place): string | undefined {
    const fault = firstFault(flow.expressions, (expression) => this.expression(expression));
    if (fault !== undefined) return fault;
    const [value] = flow.expressions;
    switch (flow.flow) {
      case 'FLOW_OP_IF':
        if (value?.type !== 'bool') return `an if of ${value?.type}`;
        return firstFault(flow.blocks, (block) => this.block(block, place));
      case 'FLOW_OP_WHILE':
      case 'FLOW_OP_DO':
        return this.block(flow.blocks[0]!, { ...place, isInLoop: true });
      case 'FLOW_OP_FOR':
        return this.forFlow(flow, place);
      case 'FLOW_OP_SWITCH':
        if (value?.type !== 'int' && value?.type !== 'uint') return `a switch of ${value?.type}`;
        return this.block(flow.blocks[0]!, { ...place, isSwitchBlock: true });
      case 'FLOW_OP_CASE':
      case 'FLOW_OP_DEFAULT':
        return this.block(flow.blocks[0]!, { ...place, isInCase: true, isSwitchBlock: false });
      case 'FLOW_OP_RETURN':
        if ((value?.type ?? 'void') !== this.definition.returnType)
          return `a return of ${value?.type ?? 'void'} in a function of ${this.definition.returnType}`;
        return undefined;
      case 'FLOW_OP_BREAK':
        return place.isInLoop || place.isInCase ? undefined : 'a break outside a loop and a switch';
      case 'FLOW_OP_CONTINUE':
        return place.isInLoop ? undefined : 'a continue outside a loop';
      case 'FLOW_OP_DISCARD':
        return undefined;
    }
  }

  /** The initialiser's names reach the conditions, the steps and the body. */
  private forFlow(flow: ControlFlowNode, place: Place): string | undefined {
    const [init, conditions, steps, body] = flow.blocks;
    if (!init || !conditions || !steps || !body) return 'a for of fewer than four blocks';
    this.scopes.push(new Map());
    try {
      const statement = init.statements[0];
      const fault =
        (statement && this.statement(statement, place)) ??
        firstFault(conditions.statements, (condition) => this.forCondition(condition)) ??
        firstFault(steps.statements, (step) => this.statement(step, place));
      return fault ?? this.block(body, { ...place, isInLoop: true });
    } finally {
      this.scopes.pop();
    }
  }

  private forCondition(condition: Statement): string | undefined {
    if (condition.kind === 'control flow' || condition.kind === 'declaration' || condition.kind === 'block')
      return `a ${statementName(condition)} as a for condition`;
    if (isEmpty(condition)) return undefined;
    return condition.type === 'bool' ? this.expression(condition) : `a for condition of ${condition.type}`;
  }

  private expression(expression: Expression): string | undefined {
    if (!this.isType(expression.type)) return `a ${expression.kind} of type ${expression.type}`;
    const { line, column } = expression.position;
    if (!(line >= 1 && column >= 1)) return `a ${expression.kind} at no line and column`;
    switch (expression.kind) {
      case 'constant':
        return constantFault(expression);
      case 'variable':
        return this.variable(expression.name, expression.type, expression.arraySize ?? 0);
      case 'member': {
        const member = swizzled(expression.owner, expression.name);
        if (typeof member === 'string' || member.type !== expression.type || member.row !== expression.row)
          return `the swizzle .${expression.name} of ${expression.owner.type}`;
        return this.expression(expression.owner);
      }
      case 'field':
        return this.field(expression) ?? this.expression(expression.owner);
      case 'array element':
        return this.arrayElement(expression);
      case 'array construct':
        return this.arrayConstruct(expression);
      case 'array length':
        if (arraySizeOf(expression.array) === 0) return `the length of a ${expression.array.type} value`;
        return this.expression(expression.array);
      case 'whole assign':
        return this.wholeAssign(expression);
      case 'operator':
        if (expression.op === 'OP_STRUCT') return this.structConstruct(expression);
        return (
          firstFault(expression.operands, (operand) => this.operand(operand)) ?? operatorFault(expression)
        );
    }
  }

  /** An operator's operand: one value, never a whole array. */
  private operand(operand: Expression): string | undefined {
    if (arraySizeOf(operand) > 0) return `an operator over the array ${operand.kind}`;
    return this.expression(operand);
  }

  private variable(name: string, type: string, arraySize: number): string | undefined {
    for (let index = this.scopes.length - 1; index >= 0; index--) {
      const declared = this.scopes[index]!.get(name);
      if (!declared) continue;
      if (declared.type !== type || declared.arraySize !== arraySize)
        return `the name ${name} read as ${type}[${arraySize}], declared ${declared.type}[${declared.arraySize}]`;
      return undefined;
    }
    return `the name ${name}, which no block around the read declares`;
  }

  private field(field: Extract<Expression, { kind: 'field' }>): string | undefined {
    const member = this.structs
      .find((struct) => struct.name === field.owner.type)
      ?.members.find((candidate) => candidate.name === field.name);
    if (!member || arraySizeOf(field.owner) > 0) return `the field .${field.name} of ${field.owner.type}`;
    if (member.type !== field.type || (member.arraySize ?? 0) !== (field.arraySize ?? 0))
      return `the field .${field.name} typed ${field.type}`;
    return undefined;
  }

  private arrayElement(element: Extract<Expression, { kind: 'array element' }>): string | undefined {
    const { array, index } = element;
    if (arraySizeOf(array) === 0 || array.type !== element.type)
      return `an element of ${array.type} typed ${element.type}`;
    if (index.type !== 'int' && index.type !== 'uint') return `an array index of ${index.type}`;
    return this.expression(array) ?? this.operand(index);
  }

  private arrayConstruct(construct: Extract<Expression, { kind: 'array construct' }>): string | undefined {
    if (construct.elements.length !== construct.arraySize)
      return `an array of ${construct.arraySize} elements built from ${construct.elements.length}`;
    return firstFault(construct.elements, (element) =>
      element.type === construct.type
        ? this.operand(element)
        : `an element of ${element.type} in an array of ${construct.type}`
    );
  }

  /** `Pair(a, b)`: one value of each member's type and size, in the members' order. */
  private structConstruct(construct: OperatorNode): string | undefined {
    const members = this.structs.find((struct) => struct.name === construct.type)?.members ?? [];
    if (members.length !== construct.operands.length)
      return `a ${construct.type} built from ${construct.operands.length} values`;
    return firstFault(construct.operands, (operand, index) => {
      const member = members[index]!;
      if (operand.type !== member.type || arraySizeOf(operand) !== (member.arraySize ?? 0))
        return `a ${operand.type} for the member ${member.name} of ${construct.type}`;
      return this.expression(operand);
    });
  }

  private wholeAssign(assign: Extract<Expression, { kind: 'whole assign' }>): string | undefined {
    const { target, value } = assign;
    if (target.type !== value.type || arraySizeOf(target) !== arraySizeOf(value))
      return `an assignment of ${value.type} to ${target.type}`;
    if (assignmentRefusal(target) !== undefined) return `a write to ${target.kind}`;
    return this.expression(target) ?? this.expression(value);
  }

  private isType(type: string): boolean {
    return shapeOf(type) !== undefined || this.structs.some((struct) => struct.name === type);
  }
}

const STEP_OPERATORS: ReadonlySet<string> = new Set([
  'OP_INCREMENT',
  'OP_DECREMENT',
  'OP_POST_INCREMENT',
  'OP_POST_DECREMENT',
]);

function operatorFault(expression: OperatorNode): string | undefined {
  const { op, operands, row, type } = expression;
  const types = operands.map((operand) => operand.type);
  if (op === 'OP_INDEX') {
    const indexType = types[1];
    if (elementType(types[0]!) !== type || (indexType !== 'int' && indexType !== 'uint'))
      return `an index of ${types.join(', ')} typed ${type}`;
  } else if (op === 'OP_CONSTRUCT') {
    if (row.id !== `${row.id.slice(0, row.id.indexOf('('))}(${types.join(',')})` || row.returns !== type)
      return `the constructor row ${row.id} over ${types.join(', ')}`;
  } else if (signatureInstruction(op, types) !== row || row.returns !== type) {
    return `the row ${row.id} over ${types.join(', ')}`;
  }
  const isWrite = isAssignOperator(op) || STEP_OPERATORS.has(op);
  if (isWrite && assignmentRefusal(operands[0]!) !== undefined) return `a write to ${operands[0]!.kind}`;
  return undefined;
}

/** A lane of each scalar kind as Godot holds it (`shaderTree.ts`, `ConstantNode`). */
const LANE_FITS: Readonly<Record<string, (lane: number | boolean) => boolean>> = {
  bool: (lane) => typeof lane === 'boolean',
  int: (lane) => Number.isInteger(lane) && (lane as number) >= -0x80000000 && (lane as number) <= 0x7fffffff,
  uint: (lane) => Number.isInteger(lane) && (lane as number) >= 0 && (lane as number) <= 0xffffffff,
  float: (lane) => typeof lane === 'number' && Object.is(Math.fround(lane), lane),
};

function constantFault(constant: ConstantNode): string | undefined {
  const shape = shapeOf(constant.type)!;
  if (constant.values.length !== shape.lanes)
    return `a ${constant.type} constant of ${constant.values.length} lanes`;
  if (!constant.values.every(LANE_FITS[shape.scalar]!))
    return `a ${constant.type} constant ${constant.values.join(', ')}`;
  return undefined;
}

const isEmpty = (statement: Statement) => statement.kind === 'operator' && statement.op === 'OP_EMPTY';

function statementName(statement: Statement): string {
  return statement.kind === 'control flow' ? statement.flow : statement.kind;
}
