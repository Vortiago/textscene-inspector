/**
 * The expressions of a template, by GLSL 4.50's grammar (section 5) and types: C's precedence,
 * the implicit conversions of section 4.1.10 written into the tree as constructors, the operand
 * rules of section 5.9 and the overload resolution of section 6.1. Each node is the shading
 * language's node for the same instruction, so one emitter reads both front ends.
 */

import type { InstructionRow } from '../language/instructionTable.generated.js';
import type { SourcePosition } from '../language/shadingLanguageError.js';
import type {
  CallNode,
  MemberNode,
  ConstantNode,
  Expression,
  OperatorNode,
  Qualifier,
  Scalar,
  StructMember,
} from '../language/shaderTree.js';
import { swizzled } from '../language/swizzle.js';
import { arraySizeOf } from '../language/treeWalk.js';
import {
  glslShapeOf,
  isTypeKeyword,
  shapeName,
  commonScalar,
  withScalar,
  canonicalType,
  convertsImplicitly,
  isOpaqueType,
  elementOf,
  lengthOf,
  type GlslShape,
  type SizedType,
} from './glslTypes.js';
import { constantScalar } from './constantValue.js';
import { builtInOverloads, constructorRow, namedRow, operatorRow, resolvedOverload } from './glslRows.js';
import type { PpToken } from './ppScanner.js';
import type { TemplateCursor } from './templateCursor.js';

/** The element count of an array of no size: the last member of a `buffer` block. */
export const RUNTIME_SIZED = Number.POSITIVE_INFINITY;

/** What a name stands for: its type, its array size, and whether a write to it is refused. */
export interface TemplateVariable {
  readonly type: string;
  readonly arraySize?: number;
  readonly isConst?: boolean;
  /** A stage input, a uniform, a `readonly` buffer or a built-in the stage only reads. */
  readonly isReadOnly?: true;
  /** The constant lanes of a `const` with a value. */
  readonly values?: readonly Scalar[];
}

/** A function of the template, as a call resolves it. */
export interface TemplateFunction {
  /** The name the tree holds: `f`, or `f@2` for the second overload. */
  readonly name: string;
  readonly rname: string;
  readonly returnType: string;
  readonly returnArraySize?: number;
  readonly parameters: readonly {
    readonly type: string;
    readonly qualifier: Qualifier;
    readonly arraySize?: number;
  }[];
}

/** What an expression sees: the names in scope, the struct and block types, and the functions. */
export interface TemplateScope {
  variable(name: string): TemplateVariable | undefined;
  members(type: string): readonly StructMember[] | undefined;
  functionsNamed(name: string): readonly TemplateFunction[];
}

/** The operators of each binary level, lowest precedence first (section 5.1). */
const BINARY_LEVELS: readonly (readonly string[])[] = [
  ['||'],
  ['^^'],
  ['&&'],
  ['|'],
  ['^'],
  ['&'],
  ['==', '!='],
  ['<', '>', '<=', '>='],
  ['<<', '>>'],
  ['+', '-'],
  ['*', '/', '%'],
];

const BINARY_OPS: Readonly<Record<string, string>> = {
  '||': 'OP_OR',
  '^^': 'OP_XOR',
  '&&': 'OP_AND',
  '|': 'OP_BIT_OR',
  '^': 'OP_BIT_XOR',
  '&': 'OP_BIT_AND',
  '==': 'OP_EQUAL',
  '!=': 'OP_NOT_EQUAL',
  '<': 'OP_LESS',
  '>': 'OP_GREATER',
  '<=': 'OP_LESS_EQUAL',
  '>=': 'OP_GREATER_EQUAL',
  '<<': 'OP_SHIFT_LEFT',
  '>>': 'OP_SHIFT_RIGHT',
  '+': 'OP_ADD',
  '-': 'OP_SUB',
  '*': 'OP_MUL',
  '/': 'OP_DIV',
  '%': 'OP_MOD',
};

const ASSIGN_OPS: Readonly<Record<string, string>> = {
  '=': 'OP_ASSIGN',
  '+=': 'OP_ASSIGN_ADD',
  '-=': 'OP_ASSIGN_SUB',
  '*=': 'OP_ASSIGN_MUL',
  '/=': 'OP_ASSIGN_DIV',
  '%=': 'OP_ASSIGN_MOD',
  '<<=': 'OP_ASSIGN_SHIFT_LEFT',
  '>>=': 'OP_ASSIGN_SHIFT_RIGHT',
  '&=': 'OP_ASSIGN_BIT_AND',
  '|=': 'OP_ASSIGN_BIT_OR',
  '^=': 'OP_ASSIGN_BIT_XOR',
};

/** The first letter of each of the three sets of names of a vector's components. */
const SCALAR_LETTERS = ['x', 'r', 's'];

const UNARY_OPS: Readonly<Record<string, string>> = {
  '-': 'OP_NEGATE',
  '!': 'OP_NOT',
  '~': 'OP_BIT_INVERT',
  '++': 'OP_INCREMENT',
  '--': 'OP_DECREMENT',
};

export class GlslExpressionParser {
  constructor(
    private readonly tokens: TemplateCursor,
    private readonly scope: TemplateScope
  ) {}

  /** An expression with its assignments: section 5.17's `assignment_expression`. */
  expression(): Expression {
    const target = this.conditional();
    const op = ASSIGN_OPS[this.tokens.peekText()];
    if (!op || this.tokens.peek()?.kind !== 'punctuator') return target;
    const operator = this.tokens.next();
    this.writable(target, operator);
    const value = this.expression();
    if (arraySizeOf(target) > 0 || this.scope.members(target.type)) {
      if (op !== 'OP_ASSIGN') this.tokens.fail('compound assignment needs a value type', operator.position);
      return {
        kind: 'whole assign',
        type: target.type,
        ...(arraySizeOf(target) > 0 ? { arraySize: arraySizeOf(target) } : {}),
        target,
        value,
        position: target.position,
      };
    }
    return this.assignment(op, target, value, operator);
  }

  /** A constant expression: an array size, a `case` label or a layout value. */
  constantInteger(): Expression {
    return this.conditional();
  }

  /** An array size: a constant integer expression greater than zero (section 4.1.9). */
  arraySize(): number {
    const expression = this.constantInteger();
    const value = constantScalar(expression, (name) => this.scope.variable(name)?.values);
    if (typeof value !== 'number' || value <= 0)
      this.tokens.fail(
        'array size must be a constant integer expression greater than zero',
        expression.position
      );
    return value;
  }

  private assignment(op: string, target: Expression, value: Expression, operator: PpToken): Expression {
    if (op === 'OP_ASSIGN')
      return this.operator(op, [target, this.converted(value, target.type)], target.type);
    const binary = op.replace('OP_ASSIGN_', 'OP_');
    const typed = this.binaryTypes(binary, target, value, operator);
    const operand = typed.operands[1]!;
    return this.operator(op, [target, operand], target.type);
  }

  /** `c ? a : b`, whose branches convert to one type. */
  private conditional(): Expression {
    const condition = this.binary(0);
    if (!this.tokens.accept('?')) return condition;
    const then = this.expression();
    this.tokens.expect(':');
    const otherwise = this.expression();
    if (condition.type !== 'bool') this.tokens.fail('boolean expression expected', condition.position);
    const type = this.commonType(then, otherwise);
    return this.operator(
      'OP_SELECT_IF',
      [condition, this.converted(then, type), this.converted(otherwise, type)],
      type
    );
  }

  private binary(level: number): Expression {
    if (level === BINARY_LEVELS.length) return this.unary();
    let left = this.binary(level + 1);
    for (;;) {
      const text = this.tokens.peekText();
      if (!BINARY_LEVELS[level]!.includes(text) || this.tokens.peek()?.kind !== 'punctuator') return left;
      const operator = this.tokens.next();
      const right = this.binary(level + 1);
      const typed = this.binaryTypes(BINARY_OPS[text]!, left, right, operator);
      left = this.operator(BINARY_OPS[text]!, typed.operands, typed.type);
    }
  }

  /** The operands of a binary operator after their conversions, and its type (section 5.9). */
  private binaryTypes(
    op: string,
    left: Expression,
    right: Expression,
    operator: PpToken
  ): { operands: Expression[]; type: string } {
    const fail = () =>
      this.tokens.fail(
        `wrong operand types: no operation '${operator.text}' exists that takes a left-hand operand of type '${left.type}' and a right operand of type '${right.type}'`,
        operator.position
      );
    if (op === 'OP_EQUAL' || op === 'OP_NOT_EQUAL') {
      const type = this.commonType(left, right);
      return { operands: [this.converted(left, type), this.converted(right, type)], type: 'bool' };
    }
    if (op === 'OP_AND' || op === 'OP_OR' || op === 'OP_XOR') {
      if (left.type !== 'bool' || right.type !== 'bool') fail();
      return { operands: [left, right], type: 'bool' };
    }
    const a = glslShapeOf(left.type);
    const b = glslShapeOf(right.type);
    if (!a || !b) return fail();
    if (op === 'OP_SHIFT_LEFT' || op === 'OP_SHIFT_RIGHT') {
      if (!isInteger(a) || !isInteger(b) || a.columns > 1 || (b.rows > 1 && b.rows !== a.rows)) fail();
      return { operands: [left, right], type: left.type };
    }
    const scalar = commonScalar(a.scalar, b.scalar);
    if (!scalar || scalar === 'bool') return fail();
    if (
      ['OP_BIT_AND', 'OP_BIT_OR', 'OP_BIT_XOR', 'OP_MOD'].includes(op) &&
      scalar !== 'int' &&
      scalar !== 'uint'
    )
      fail();
    const operands = [
      this.converted(left, withScalar(a, scalar)),
      this.converted(right, withScalar(b, scalar)),
    ];
    if (['OP_LESS', 'OP_GREATER', 'OP_LESS_EQUAL', 'OP_GREATER_EQUAL'].includes(op)) {
      if (a.rows > 1 || b.rows > 1) fail();
      return { operands, type: 'bool' };
    }
    const shape = resultShape(op, a, b);
    if (!shape) return fail();
    return { operands, type: shapeName({ ...shape, scalar }) };
  }

  /** The type both values convert to, or a refusal. */
  private commonType(a: Expression, b: Expression): string {
    if (convertsImplicitly(b.type, a.type) && arraySizeOf(a) === arraySizeOf(b)) return a.type;
    if (convertsImplicitly(a.type, b.type) && arraySizeOf(a) === arraySizeOf(b)) return b.type;
    return this.tokens.fail(`cannot convert between '${a.type}' and '${b.type}'`, b.position);
  }

  private unary(): Expression {
    const token = this.tokens.peek();
    if (token?.kind === 'punctuator' && token.text === '+') {
      this.tokens.next();
      return this.unary();
    }
    const op = token?.kind === 'punctuator' ? UNARY_OPS[token.text] : undefined;
    if (!op) return this.postfix(this.primary());
    this.tokens.next();
    const operand = this.unary();
    if (op === 'OP_INCREMENT' || op === 'OP_DECREMENT') this.writable(operand, token!);
    const shape = glslShapeOf(operand.type);
    if (!shape)
      this.tokens.fail(`wrong operand type for '${token!.text}': '${operand.type}'`, token!.position);
    if (op === 'OP_NEGATE' && operand.kind === 'constant' && shape.scalar !== 'bool')
      return negated(operand, token!);
    return this.operator(op, [operand], operand.type);
  }

  /** Fails unless `target` names storage the program may write, as glslang's l-value check does. */
  private writable(target: Expression, operator: PpToken): void {
    const root = storageOf(target);
    const variable = root.kind === 'variable' ? this.scope.variable(root.name) : undefined;
    if (!variable || variable.isConst || variable.isReadOnly)
      this.tokens.fail(`'${operator.text}' : l-value required`, operator.position);
  }

  private postfix(start: Expression): Expression {
    let node = start;
    for (;;) {
      const token = this.tokens.peek();
      if (token?.kind !== 'punctuator') return node;
      if (token.text === '[') node = this.indexed(node);
      else if (token.text === '.') node = this.member(node);
      else if (token.text === '++' || token.text === '--') {
        this.tokens.next();
        this.writable(node, token);
        node = this.operator(
          token.text === '++' ? 'OP_POST_INCREMENT' : 'OP_POST_DECREMENT',
          [node],
          node.type
        );
      } else return node;
    }
  }

  private indexed(owner: Expression): Expression {
    const open = this.tokens.expect('[');
    const index = this.expression();
    this.tokens.expect(']');
    if (index.type !== 'int' && index.type !== 'uint')
      this.tokens.fail('integer expression required', open.position);
    if (arraySizeOf(owner) > 0) {
      const { type, arraySize } = elementOf(owner.type);
      return {
        kind: 'array element',
        type,
        array: owner,
        index,
        position: owner.position,
        ...(arraySize !== undefined ? { arraySize } : {}),
      };
    }
    const shape = glslShapeOf(owner.type);
    if (!shape || (shape.columns === 1 && shape.rows === 1))
      this.tokens.fail(`'${owner.type}' cannot be indexed`, open.position);
    const type =
      shape.columns > 1
        ? shapeName({ scalar: shape.scalar, columns: 1, rows: shape.rows })
        : shapeName({ ...shape, rows: 1 });
    return {
      kind: 'operator',
      type,
      op: 'OP_INDEX',
      row: namedRow('OP_INDEX'),
      operands: [owner, index],
      position: owner.position,
    };
  }

  private member(owner: Expression): Expression {
    this.tokens.expect('.');
    const name = this.tokens.identifier();
    if (arraySizeOf(owner) > 0) {
      if (name.text !== 'length') this.tokens.fail('an array has only the method length()', name.position);
      this.tokens.expect('(');
      this.tokens.expect(')');
      return { kind: 'array length', type: 'int', array: owner, position: name.position };
    }
    const members = this.scope.members(owner.type);
    if (members) {
      const member = members.find((candidate) => candidate.name === name.text);
      if (!member) this.tokens.fail(`no such field in structure: ${name.text}`, name.position);
      return {
        kind: 'field',
        type: member.type,
        owner,
        name: name.text,
        position: owner.position,
        ...(member.arraySize !== undefined ? { arraySize: member.arraySize } : {}),
      };
    }
    if (name.text === 'length' && this.tokens.peekText() === '(') return this.lengthMethod(owner, name);
    const shape = glslShapeOf(owner.type);
    if (shape?.columns === 1 && shape.rows === 1) return this.scalarSwizzle(owner, name, shape);
    const swizzle =
      shape?.scalar === 'float16' ? float16Swizzle(owner, name.text, shape) : swizzled(owner, name.text);
    if (typeof swizzle === 'string')
      this.tokens.fail(`illegal vector field selection: ${name.text}`, name.position);
    return swizzle;
  }

  /** `v.length()` of a vector or a matrix: a constant, as glslang folds it (section 5.5). */
  private lengthMethod(owner: Expression, name: PpToken): Expression {
    this.tokens.expect('(');
    this.tokens.expect(')');
    const length = lengthOf(owner.type);
    if (length < 2) this.tokens.fail(`'${owner.type}' has no method length()`, name.position);
    return { kind: 'constant', type: 'int', values: [length], position: name.position };
  }

  /**
   * `s.x` or `s.xxx` of a scalar (section 5.5): the scalar, or the vector of its copies. The tree
   * holds the vector's constructor, which glslang compiles to the same instruction.
   */
  private scalarSwizzle(owner: Expression, name: PpToken, shape: GlslShape): Expression {
    const letters = name.text;
    if (letters.length > 4 || !SCALAR_LETTERS.some((letter) => [...letters].every((each) => each === letter)))
      this.tokens.fail(`illegal vector field selection: ${letters}`, name.position);
    if (letters.length === 1) return owner;
    const type = shapeName({ ...shape, rows: letters.length });
    const row = constructorRow(type, [owner.type]);
    return { kind: 'operator', type, op: 'OP_CONSTRUCT', row, operands: [owner], position: owner.position };
  }

  private primary(): Expression {
    const token = this.tokens.next();
    if (token.kind === 'number')
      return numberConstant(token, (reason) => this.tokens.fail(reason, token.position));
    if (token.kind === 'punctuator' && token.text === '(') {
      const inner = this.expression();
      this.tokens.expect(')');
      return inner;
    }
    if (token.kind !== 'identifier') this.tokens.fail('syntax error', token.position);
    if (token.text === 'true' || token.text === 'false')
      return { kind: 'constant', type: 'bool', values: [token.text === 'true'], position: token.position };
    if (isTypeKeyword(token.text)) return this.construction(token);
    if (this.tokens.peekText() === '(') return this.call(token);
    const found = this.scope.variable(token.text);
    if (!found) this.tokens.fail(`undeclared identifier: ${token.text}`, token.position);
    return {
      kind: 'variable',
      type: found.type,
      name: token.text,
      position: token.position,
      ...(found.arraySize !== undefined ? { arraySize: found.arraySize } : {}),
      ...(found.isConst ? { isConst: true } : {}),
    };
  }

  /** `vec3(a, b)`, `sampler2D(t, s)`, or an array constructor `float[](a, b)` (section 5.4). */
  private construction(typeToken: PpToken): Expression {
    const type = canonicalType(typeToken.text);
    if (this.tokens.accept('[')) {
      const size = this.tokens.peekText() === ']' ? undefined : this.arraySize();
      this.tokens.expect(']');
      const elements = this.argumentList().map((element) => this.converted(element, type));
      if (size !== undefined && size !== elements.length)
        this.tokens.fail(
          `array constructor of ${type}[${size}] takes ${size} elements, found ${elements.length}`,
          typeToken.position
        );
      return {
        kind: 'array construct',
        type,
        arraySize: elements.length,
        elements,
        position: typeToken.position,
      };
    }
    const args = this.argumentList();
    if (
      !isOpaqueType(type) &&
      !constructs(
        type,
        args.map((arg) => arg.type)
      )
    )
      this.tokens.fail(`constructor cannot take these arguments: ${type}`, typeToken.position);
    const row = constructorRow(
      type,
      args.map((arg) => arg.type)
    );
    return { kind: 'operator', type, op: 'OP_CONSTRUCT', row, operands: args, position: typeToken.position };
  }

  private argumentList(): Expression[] {
    this.tokens.expect('(');
    const args: Expression[] = [];
    if (this.tokens.accept(')')) return args;
    if (this.tokens.peekText() === 'void' && this.tokens.peekText(1) === ')') {
      this.tokens.next();
      this.tokens.next();
      return args;
    }
    for (;;) {
      args.push(this.expression());
      if (this.tokens.accept(')')) return args;
      this.tokens.expect(',');
    }
  }

  /** A struct's constructor, a call of a function of the template, or of a built-in. */
  private call(name: PpToken): Expression {
    const args = this.argumentList();
    const members = this.scope.members(name.text);
    if (members) {
      if (args.length !== members.length)
        this.tokens.fail(`wrong number of arguments for ${name.text}`, name.position);
      const operands = members.map((member, index) => this.converted(args[index]!, member.type));
      return {
        kind: 'operator',
        type: name.text,
        op: 'OP_STRUCT',
        row: namedRow('OP_STRUCT'),
        operands,
        position: name.position,
      };
    }
    const user = this.scope.functionsNamed(name.text);
    if (user.length > 0) return this.userCall(name, user, args);
    const row = resolvedOverload(
      builtInOverloads(name.text),
      args.map((arg) => arg.type)
    );
    if (!row)
      this.tokens.fail(
        `no matching overloaded function found: ${name.text}(${args.map((arg) => arg.type).join(', ')})`,
        name.position
      );
    const operands = args.map((arg, index) => this.converted(arg, row.args![index]!));
    return builtInCall(name, row, operands);
  }

  private userCall(
    name: PpToken,
    candidates: readonly TemplateFunction[],
    args: readonly Expression[]
  ): Expression {
    const fits = (candidate: TemplateFunction, exact: boolean) =>
      candidate.parameters.length === args.length &&
      candidate.parameters.every((parameter, index) => {
        const arg = args[index]!;
        if ((parameter.arraySize ?? 0) !== arraySizeOf(arg)) return false;
        if (exact || parameter.qualifier !== 'in')
          return canonicalType(arg.type) === canonicalType(parameter.type);
        return convertsImplicitly(arg.type, parameter.type);
      });
    const chosen =
      candidates.find((candidate) => fits(candidate, true)) ??
      candidates.find((candidate) => fits(candidate, false));
    if (!chosen) this.tokens.fail(`no matching overloaded function found: ${name.text}`, name.position);
    const call: CallNode = {
      kind: 'operator',
      op: 'OP_CALL',
      row: namedRow('OP_CALL'),
      function: chosen.name,
      rname: chosen.rname,
      qualifiers: chosen.parameters.map((parameter) => parameter.qualifier),
      type: chosen.returnType,
      ...(chosen.returnArraySize ? { arraySize: chosen.returnArraySize } : {}),
      operands: args.map((arg, index) => this.converted(arg, chosen.parameters[index]!.type)),
      position: name.position,
    };
    return call;
  }

  /** The value of an initialiser list of `declared`, from its parts, each of its own type already. */
  constructed(declared: SizedType, parts: readonly Expression[], position: SourcePosition): Expression {
    const { type, arraySize } = declared;
    if (arraySize !== undefined) {
      if (arraySize !== RUNTIME_SIZED && parts.length !== arraySize)
        this.tokens.fail(`expected ${arraySize} initialisers for the array, found ${parts.length}`, position);
      return { kind: 'array construct', type, arraySize: parts.length, elements: parts, position };
    }
    const members = this.scope.members(type);
    const expected = members?.length ?? lengthOf(type);
    if (parts.length !== expected)
      this.tokens.fail(`expected ${expected} initialisers for ${type}, found ${parts.length}`, position);
    if (members)
      return {
        kind: 'operator',
        type,
        op: 'OP_STRUCT',
        row: namedRow('OP_STRUCT'),
        operands: parts,
        position,
      };
    const row = constructorRow(
      type,
      parts.map((part) => part.type)
    );
    return { kind: 'operator', type, op: 'OP_CONSTRUCT', row, operands: parts, position };
  }

  /** `value` as `type`: itself, or the constructor its implicit conversion is. */
  converted(value: Expression, type: string): Expression {
    if (canonicalType(value.type) === canonicalType(type)) return value;
    if (!convertsImplicitly(value.type, type))
      this.tokens.fail(`cannot convert from '${value.type}' to '${type}'`, value.position);
    const row = constructorRow(type, [value.type]);
    return {
      kind: 'operator',
      type: canonicalType(type),
      op: 'OP_CONSTRUCT',
      row,
      operands: [value],
      position: value.position,
    };
  }

  private operator(op: string, operands: readonly Expression[], type: string): OperatorNode {
    const row = operatorRow(
      op,
      operands.map((operand) => operand.type),
      type
    );
    return {
      kind: 'operator',
      type: canonicalType(type),
      op,
      row,
      operands,
      position: operands[0]!.position,
    };
  }
}

/**
 * A negated literal as one constant, as glslang folds it: a negation is exact, and the printed
 * text then keeps a ternary's part as the template has it.
 */
function negated(constant: ConstantNode, token: PpToken): ConstantNode {
  const values = constant.values.map((value) =>
    constant.type === 'int'
      ? -(value as number) | 0
      : constant.type === 'uint'
        ? -(value as number) >>> 0
        : -(value as number)
  );
  return { ...constant, values, position: token.position };
}

const isInteger = (shape: GlslShape) => shape.scalar === 'int' || shape.scalar === 'uint';

/** The shape of an arithmetic result over operands of one scalar kind, or nothing for none. */
function resultShape(op: string, a: GlslShape, b: GlslShape): Omit<GlslShape, 'scalar'> | undefined {
  const isScalar = (shape: GlslShape) => shape.columns === 1 && shape.rows === 1;
  if (op === 'OP_MUL' && (a.columns > 1 || b.columns > 1) && !isScalar(a) && !isScalar(b)) {
    if (a.columns > 1 && b.columns > 1)
      return a.columns === b.rows ? { columns: b.columns, rows: a.rows } : undefined;
    if (a.columns > 1) return a.columns === b.rows ? { columns: 1, rows: a.rows } : undefined;
    return a.rows === b.rows ? { columns: 1, rows: b.columns } : undefined;
  }
  if (isScalar(a)) return b;
  if (isScalar(b)) return a;
  return a.columns === b.columns && a.rows === b.rows ? a : undefined;
}

/** Whether `type` constructs from `args` (section 5.4.1 and 5.4.2): one scalar, or enough components. */
function constructs(type: string, args: readonly string[]): boolean {
  const target = glslShapeOf(type);
  if (!target) return false;
  const shapes = args.map(glslShapeOf);
  if (shapes.some((shape) => !shape) || shapes.length === 0) return false;
  if (shapes.length === 1) return true;
  const needed = target.columns * target.rows;
  let total = 0;
  for (const [index, shape] of shapes.entries()) {
    if (total >= needed) return false;
    if (target.columns > 1 && shape!.columns > 1) return false;
    total += shape!.columns * shape!.rows;
    if (index === shapes.length - 1) return total >= needed;
  }
  return false;
}

function builtInCall(name: PpToken, row: InstructionRow, operands: readonly Expression[]): CallNode {
  return {
    kind: 'operator',
    op: 'OP_CALL',
    row,
    function: name.text,
    rname: name.text,
    qualifiers: operands.map(() => 'in'),
    type: row.returns!,
    operands,
    position: name.position,
  };
}

/** A literal as glslang reads it: decimal, octal or hexadecimal integers, floats with a suffix. */
function numberConstant(token: PpToken, fail: (reason: string) => never): ConstantNode {
  const text = token.text;
  const integer = /^(0[xX][0-9a-fA-F]+|0[0-7]*|[1-9]\d*)([uU]?)$/.exec(text);
  if (integer) {
    const digits = integer[1]!;
    const value =
      digits.startsWith('0x') || digits.startsWith('0X')
        ? Number.parseInt(digits, 16)
        : /^0\d/.test(digits)
          ? Number.parseInt(digits, 8)
          : Number(digits);
    if (value > 0xffffffff) fail('integer constant overflow');
    const isUnsigned = integer[2] !== '';
    return constant(isUnsigned ? 'uint' : 'int', isUnsigned ? value >>> 0 : value | 0, token);
  }
  const float = /^(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)([fF]|lf|LF|hf|HF)?$/.exec(text);
  if (!float) return fail(`bad numeric literal: ${text}`);
  // A double, as glslang holds a literal: it folds constant expressions in double precision.
  const type = /^h/i.test(float[2] ?? '') ? 'float16_t' : 'float';
  return constant(type, Number(float[1]), token);
}

/** The variable an element, a field, a component or a swizzle of `target` reads from. */
function storageOf(target: Expression): Expression {
  if (target.kind === 'array element') return storageOf(target.array);
  if (target.kind === 'field' || target.kind === 'member') return storageOf(target.owner);
  if (target.kind === 'operator' && target.op === 'OP_INDEX') return storageOf(target.operands[0]!);
  return target;
}

const constant = (type: string, value: Scalar, token: PpToken): ConstantNode => ({
  kind: 'constant',
  type,
  values: [value],
  position: token.position,
});

/**
 * A swizzle of a 16-bit float vector: the swizzle of the float vector of its lanes, which names
 * the same row, with 16-bit types. Godot's language has no 16-bit types.
 */
function float16Swizzle(owner: Expression, letters: string, shape: GlslShape): MemberNode | string {
  const swizzle = swizzled({ ...owner, type: withScalar(shape, 'float') } as Expression, letters);
  if (typeof swizzle === 'string') return swizzle;
  return { ...swizzle, owner, type: withScalar({ ...shape, rows: letters.length }, 'float16') };
}
