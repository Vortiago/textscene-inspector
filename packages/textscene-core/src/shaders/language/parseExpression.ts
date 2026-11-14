/**
 * Godot's `_parse_expression` (`shader_language.cpp:5959`): it reads operands, each with its
 * postfix members, indexes and increments, and the operators between them into a flat list, then
 * reduces the list into the typed tree. The messages and the lines they name are Godot's.
 */

import { reduced } from './constants.js';
import { matchedConstructor } from './constructors.js';
import {
  godotIntScalar,
  godotIntegerConstant,
  godotLiteralScalar,
  godotNumberText,
  godotStrtod,
  godotUintScalar,
} from './godotNumber.js';
import {
  builtInInstruction,
  firstInstruction,
  instruction,
  keywordInstruction,
  notTranspiled,
  signatureInstruction,
} from './instructions.js';
import { assignmentRefusal } from './assignment.js';
import { BINARY_OPERATOR_OF_TOKEN, OPERATOR_TOKENS, UNARY_OPERATOR_OF_TOKEN } from './operators.js';
import { type Entry, reducedEntries } from './reduction.js';
import type { Identifier } from './scope.js';
import type { ConstantNode, Expression, OperatorNode, Scalar, StructNode } from './shaderTree.js';
import { ArrayParser } from './parseArray.js';
import { type CallScope, resolvedCall } from './parseCall.js';
import { arraySizeOf, typeName } from './treeWalk.js';
import { swizzled } from './swizzle.js';
import type { TokenCursor } from './tokenCursor.js';
import type { Token } from './tokenizer.js';
import { elementType, shapeOf } from './types.js';
import {
  DEPTH_MESSAGE,
  expressionDepth,
  LENGTH_MESSAGE,
  MAX_EXPRESSION_DEPTH,
  MAX_LIST_ENTRIES,
} from './expressionLimits.js';

/** What a name stands for where the expression stands, and the structs of the shader. */
export interface ExpressionScope extends CallScope {
  identifier(name: string): Identifier | undefined;
  struct(name: string): StructNode | undefined;
}

/**
 * `ExpressionInfo`: the list of the expression a ternary's part belongs to, which the part joins
 * when it ends, and whether a `:` ends the part.
 */
interface TernaryPart {
  readonly entries: Entry[];
  readonly endsAtColon: boolean;
}

export class ExpressionParser {
  /** The array constructors, which read their elements with this parser. */
  readonly arrays: ArrayParser;

  constructor(
    private readonly tokens: TokenCursor,
    private readonly scope: ExpressionScope
  ) {
    this.arrays = new ArrayParser(tokens, this, scope);
  }

  /**
   * Set while the value of a `const` declaration is read (Godot's `is_const_decl`): a variable it
   * reads must be constant. Written by the declaration parser around each value.
   */
  isConstDeclaration = false;

  /**
   * The array whose `.` the expression being read follows (Godot's `TAG_ARRAY` block tag): there
   * a call names an array method, `length()`, and any other name is unknown.
   */
  private arrayOfCall: Expression | undefined;

  /** How many lists `unreducedExpression` reads at once: brackets, arguments and ternary parts. */
  private nesting = 0;

  /** `_parse_and_reduce_expression` (`shader_language.cpp:7949`). */
  expression(): Expression {
    return reduced(this.unreducedExpression());
  }

  /** Set while a step of a `for` is read, where a `)` stands for the empty expression. */
  private isForStep = false;

  /** A step of a `for`: an expression, or nothing before the `)` (`shader_language.cpp:6766`). */
  forStepExpression(): Expression {
    this.isForStep = true;
    try {
      return this.expression();
    } finally {
      this.isForStep = false;
    }
  }

  private unreducedExpression(part?: TernaryPart): Expression {
    if (this.nesting >= MAX_EXPRESSION_DEPTH) this.tokens.fail(DEPTH_MESSAGE);
    this.nesting += 1;
    try {
      return this.unreducedList(part);
    } finally {
      this.nesting -= 1;
    }
  }

  private unreducedList(part: TernaryPart | undefined): Expression {
    const entries: Entry[] = [];
    for (;;) {
      if (entries.length > MAX_LIST_ENTRIES) this.tokens.fail(LENGTH_MESSAGE);
      const operand = this.operand(entries);
      if (operand === undefined) continue;
      entries.push({ isOperator: false, node: this.postfix(operand) });
      const mark = this.tokens.mark();
      const token = this.tokens.next();
      if (part?.endsAtColon && token.type === 'TK_COLON') break;
      if (!OPERATOR_TOKENS.has(token.type)) {
        this.tokens.reset(mark);
        break;
      }
      const op = BINARY_OPERATOR_OF_TOKEN.get(token.type);
      if (op === undefined) this.tokens.fail(`Invalid token for the operator: '${tokenText(token)}'.`);
      entries.push({ isOperator: true, op, position: token.position });
      if (op === 'OP_SELECT_IF') {
        this.ternaryParts(entries, part);
        break;
      }
    }
    const node = reducedEntries(entries, (message) => this.tokens.fail(message));
    if (expressionDepth(node) > MAX_EXPRESSION_DEPTH) this.tokens.fail(DEPTH_MESSAGE);
    part?.entries.push({ isOperator: false, node: ternaryOperand(node) });
    return node;
  }

  /**
   * The parts after `?` (`shader_language.cpp:7461`): each joins `entries`. The then part ends at a
   * `:`, and so does the else part of a ternary inside another's then part.
   */
  private ternaryParts(entries: Entry[], part: TernaryPart | undefined): void {
    this.unreducedExpression({ entries, endsAtColon: true });
    entries.push({ isOperator: true, op: 'OP_SELECT_ELSE', position: this.tokens.lastPosition() });
    this.unreducedExpression({ entries, endsAtColon: part?.endsAtColon ?? false });
  }

  /** One operand, or nothing after a unary operator, which joins `entries` (`shader_language.cpp:5968`). */
  private operand(entries: Entry[]): Expression | undefined {
    const mark = this.tokens.mark();
    const token = this.tokens.next();
    const unary = UNARY_OPERATOR_OF_TOKEN.get(token.type);
    if (unary !== undefined) {
      entries.push({ isOperator: true, op: unary, position: token.position });
      return undefined;
    }
    switch (token.type) {
      case 'TK_PARENTHESIS_OPEN': {
        const inner = this.expression();
        this.tokens.expect('TK_PARENTHESIS_CLOSE', "Expected ')' in expression.");
        return inner;
      }
      case 'TK_FLOAT_CONSTANT':
        return constantOf(token, 'float', this.floatLiteral(token));
      case 'TK_INT_CONSTANT':
        return constantOf(token, 'int', godotIntScalar(godotIntegerConstant(token.text!)));
      case 'TK_UINT_CONSTANT':
        return constantOf(token, 'uint', godotUintScalar(godotIntegerConstant(token.text!)));
      case 'TK_TRUE':
      case 'TK_FALSE':
        return constantOf(token, 'bool', token.type === 'TK_TRUE');
      case 'TK_TYPE_VOID':
        return this.tokens.fail('Void value not allowed in expression.');
      case 'TK_CURLY_BRACKET_OPEN':
        this.tokens.reset(mark);
        return this.arrays.constructed();
      case 'TK_IDENTIFIER':
        return this.identifier(token);
      case 'TK_OP_ADD':
        return undefined;
      case 'TK_SEMICOLON':
        this.tokens.reset(mark);
        return emptyExpression(token);
      case 'TK_PARENTHESIS_CLOSE':
        if (!this.isForStep) break;
        this.tokens.reset(mark);
        return emptyExpression(token);
    }
    if (isDataTypeToken(token.type)) {
      if (this.tokens.peek().type !== 'TK_BRACKET_OPEN') return this.construction(token);
      this.tokens.reset(mark);
      return this.arrays.constructed();
    }
    this.tokens.fail(`Expected expression, found: '${tokenText(token)}'.`);
  }

  /** A constructor, `vec3(a, 1.0)` (`shader_language.cpp:6046`), folded when its arguments are constants. */
  private construction(typeToken: Token): Expression {
    const type = keywordInstruction(typeToken.type)!.id;
    const token = this.tokens.next();
    if (token.type !== 'TK_PARENTHESIS_OPEN') this.tokens.fail("Expected '(' after the type name.");
    const overload = matchedConstructor(type, this.argumentList());
    if (!overload) this.tokens.fail(`No matching constructor found for: '${type}'.`);
    const construction: OperatorNode = {
      kind: 'operator',
      type: overload.row.returns!,
      op: 'OP_CONSTRUCT',
      row: overload.row,
      operands: overload.operands,
      position: typeToken.position,
    };
    return reduced(construction);
  }

  /** `_parse_function_arguments` (`shader_language.cpp:4075`), after the `(`. */
  private argumentList(): Expression[] {
    const args: Expression[] = [];
    if (this.tokens.accept('TK_PARENTHESIS_CLOSE')) return args;
    for (;;) {
      args.push(this.expression());
      const token = this.tokens.next();
      if (token.type === 'TK_PARENTHESIS_CLOSE') return args;
      if (token.type !== 'TK_COMMA') this.tokens.fail("Expected ',' or ')' after argument.");
    }
  }

  /**
   * A struct's constructor, a call, or a read of a variable (`shader_language.cpp:6106`). Inside
   * an array's call only `length()` is known.
   */
  private identifier(token: Token): Expression {
    const name = token.text!;
    const struct = this.scope.struct(name);
    if (this.tokens.peek().type === 'TK_PARENTHESIS_OPEN') {
      this.tokens.next();
      if (struct) return this.structConstruction(struct, token);
      if (this.arrayOfCall) return this.arrayCall(name, token);
      return this.call(name, this.argumentList(), token);
    }
    if (this.arrayOfCall) this.tokens.fail(`Unknown identifier in expression: '${name}'.`);
    const found = this.scope.identifier(name);
    if (!found) {
      const builtIn = builtInInstruction(name);
      if (builtIn) throw notTranspiled(builtIn, token.position, name);
      this.tokens.fail(`Unknown identifier in expression: '${name}'.`);
    }
    if (found.kind === 'function') this.tokens.fail(`Can't use function as identifier: '${name}'.`);
    if (this.isConstDeclaration && !found.isConst) this.tokens.fail('Expected constant expression.');
    const variable = {
      kind: 'variable',
      type: found.type,
      name,
      position: token.position,
      ...(found.arraySize > 0 ? { arraySize: found.arraySize } : {}),
      ...(found.isConst ? { isConst: true } : {}),
      ...(found.kind === 'built-in' ? { builtIn: found.row } : {}),
    } as const;
    return found.arraySize > 0 ? this.arrayAccess(variable) : variable;
  }

  /** `Pair(a, b)`: one value of each member's type, in order (`shader_language.cpp:6123`). */
  private structConstruction(struct: StructNode, token: Token): Expression {
    const operands = struct.members.map((member, index) => {
      if (index > 0 && this.tokens.next().type !== 'TK_COMMA') this.tokens.fail("Expected a ','.");
      const value =
        member.arraySize !== undefined
          ? this.arrays.typedConstructed(member.type, member.arraySize)
          : this.expression();
      this.requireType(member.type, member.arraySize, value);
      return value;
    });
    if (this.tokens.next().type !== 'TK_PARENTHESIS_CLOSE') this.tokens.fail("Expected a ')'.");
    return {
      kind: 'operator',
      type: struct.name,
      op: 'OP_STRUCT',
      row: instruction('OP_STRUCT')!,
      operands,
      position: token.position,
    };
  }

  /** `length()` of the array before the `.`, the one method of an array (`shader_language.cpp:3400`). */
  private arrayCall(name: string, token: Token): Expression {
    if (name !== 'length') this.tokens.fail(`Unknown identifier in expression: '${name}'.`);
    if (this.argumentList().length > 0)
      this.tokens.fail(`Invalid arguments for the built-in function: '${name}()'.`);
    return { kind: 'array length', type: 'int', array: this.arrayOfCall!, position: token.position };
  }

  /**
   * What follows an array, an argument's or a struct member's (`shader_language.cpp:6657`): a whole
   * new value after `=`, an expression of its methods after `.`, one element in `[]`, or nothing.
   */
  private arrayAccess(array: Expression & { readonly arraySize?: number }): Expression {
    const mark = this.tokens.mark();
    const token = this.tokens.next();
    if (token.type === 'TK_OP_ASSIGN') {
      const refusal = assignmentRefusal(array);
      if (refusal !== undefined) this.tokens.fail(refusal);
      const value = this.arrays.typedConstructed(array.type, array.arraySize!);
      return {
        kind: 'whole assign',
        type: array.type,
        arraySize: array.arraySize!,
        target: array,
        value,
        position: array.position,
      };
    }
    if (token.type === 'TK_PERIOD') return this.arrayMethods(array);
    if (token.type === 'TK_BRACKET_OPEN') return this.arrayElement(array);
    this.tokens.reset(mark);
    return array;
  }

  /** The expression after an array's `.`, read where only the array's methods are known. */
  private arrayMethods(array: Expression): Expression {
    const outer = this.arrayOfCall;
    this.arrayOfCall = array;
    try {
      return this.expression();
    } finally {
      this.arrayOfCall = outer;
    }
  }

  /** `array[index]`: Godot refuses a constant index out of range, as a signed number. */
  private arrayElement(array: Expression & { readonly arraySize?: number }): Expression {
    const index = this.expression();
    if (arraySizeOf(index) !== 0 || (index.type !== 'int' && index.type !== 'uint'))
      this.tokens.fail('Only integer expressions are allowed for indexing.');
    const size = array.arraySize!;
    if (index.kind === 'constant') {
      const value = index.values[0] as number | 0;
      const signed = value | 0;
      if (signed < 0 || signed >= size) this.tokens.fail(`Index [${signed}] out of range [0..${size - 1}].`);
    }
    if (this.tokens.next().type !== 'TK_BRACKET_CLOSE') this.tokens.fail("Expected a ']'.");
    return { kind: 'array element', type: array.type, array, index, position: array.position };
  }

  /** Godot's `_compare_datatypes`: `value` must be of `type`, with `arraySize` elements. */
  requireType(type: string, arraySize: number | undefined, value: Expression): void {
    const valueSize = arraySizeOf(value);
    if (value.type === type && valueSize === (arraySize ?? 0)) return;
    this.tokens.fail(
      `Invalid assignment of '${typeName(value.type, valueSize)}' to '${typeName(type, arraySize ?? 0)}'.`
    );
  }

  /** A call of a function of the shader. A built-in function is refused with its overload's row. */
  private call(name: string, args: readonly Expression[], token: Token): Expression {
    const overload = signatureInstruction(
      name,
      args.map((arg) => arg.type)
    );
    if (overload) throw notTranspiled(overload, token.position);
    const anyOverload = firstInstruction(`${name}(`);
    if (anyOverload) throw notTranspiled(anyOverload, token.position, name);
    const call = resolvedCall(this.scope, name, args, token.position, (message) => this.tokens.fail(message));
    return call.arraySize ? this.arrayAccess(call) : call;
  }

  /** The members, indexes and increments after an operand (`shader_language.cpp:6800`). */
  private postfix(operand: Expression): Expression {
    let node = operand;
    for (;;) {
      const mark = this.tokens.mark();
      const token = this.tokens.next();
      if (token.type === 'TK_PERIOD') node = this.member(node);
      else if (token.type === 'TK_BRACKET_OPEN') node = this.index(node);
      else if (token.type === 'TK_OP_INCREMENT' || token.type === 'TK_OP_DECREMENT') {
        node = this.postIncrement(
          node,
          token.type === 'TK_OP_INCREMENT' ? 'OP_POST_INCREMENT' : 'OP_POST_DECREMENT'
        );
      } else {
        this.tokens.reset(mark);
        return node;
      }
    }
  }

  /**
   * `.` after `owner`: the methods of an array that is not indexed, a struct's member, or a
   * swizzle (`shader_language.cpp:6805`).
   */
  private member(owner: Expression): Expression {
    if (arraySizeOf(owner) > 0) return this.arrayMethods(owner);
    const token = this.tokens.next();
    if (token.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected an identifier as a member.');
    const struct = this.scope.struct(owner.type);
    if (struct) return this.field(owner, struct, token);
    const member = swizzled(owner, token.text!);
    if (typeof member === 'string') this.tokens.fail(member);
    return member;
  }

  /** The member `name` of a struct value, and what follows it when it is an array. */
  private field(owner: Expression, struct: StructNode, token: Token): Expression {
    const name = token.text!;
    const member = struct.members.find((candidate) => candidate.name === name);
    if (!member) this.tokens.fail(`Invalid member for '${struct.name}' expression: '.${name}'.`);
    const field = {
      kind: 'field',
      type: member.type,
      owner,
      name,
      position: owner.position,
      ...(member.arraySize !== undefined ? { arraySize: member.arraySize } : {}),
    } as const;
    return member.arraySize !== undefined ? this.arrayAccess(field) : field;
  }

  /** `owner[index]` on a vector or a matrix (`shader_language.cpp:7180`). */
  private index(owner: Expression): Expression {
    const index = this.expression();
    if (index.type !== 'int' && index.type !== 'uint')
      this.tokens.fail('Only integer expressions are allowed for indexing.');
    const type = elementType(owner.type);
    if (type === undefined) this.tokens.fail(`An object of type '${owner.type}' can't be indexed.`);
    const shape = shapeOf(owner.type)!;
    const size = shape.columns ?? shape.lanes;
    if (index.kind === 'constant') {
      // Godot reads the constant's lane as unsigned, so -1 is out of range as 4294967295.
      const lane = (index.values[0] as number) >>> 0;
      if (lane >= size) this.tokens.fail(`Index [${lane}] out of range [0..${size - 1}].`);
    }
    this.tokens.expect('TK_BRACKET_CLOSE', "Expected a ']'.");
    return {
      kind: 'operator',
      type,
      op: 'OP_INDEX',
      row: instruction('OP_INDEX')!,
      operands: [owner, index],
      position: owner.position,
    };
  }

  private postIncrement(operand: Expression, op: string): Expression {
    const row = signatureInstruction(op, [operand.type]);
    if (!row) this.tokens.fail('Invalid base type for increment/decrement operator.');
    const refusal = assignmentRefusal(operand);
    if (refusal !== undefined) this.tokens.fail(refusal);
    return { kind: 'operator', type: row.returns!, op, row, operands: [operand], position: operand.position };
  }

  /** The float Godot holds for a literal, or the refusal of one whose text no GLSL compiler reads. */
  private floatLiteral(token: Token): number {
    try {
      return godotLiteralScalar(token.text!);
    } catch (error) {
      this.tokens.fail(`float literal '${token.text}': ${(error as Error).message}`);
    }
  }
}

/**
 * The node a ternary's part leaves in the list (`shader_language.cpp:7832`), which Godot takes
 * before it reduces the part. Its reduction then negates a constant in place, so a negated
 * constant there reads as the negation of the folded constant: `-vec2(1.0)` as `-vec2(-1.0)`.
 */
function ternaryOperand(node: Expression): Expression {
  if (node.kind !== 'operator' || node.op !== 'OP_NEGATE') return reduced(node);
  const folded = reduced(node);
  return folded.kind === 'constant' ? { ...node, operands: [folded] } : folded;
}

const isDataTypeToken = (type: string) => keywordInstruction(type)?.family === 'data type';

/** A constant of one scalar, at its token. */
const constantOf = (token: Token, type: string, value: Scalar): ConstantNode => ({
  kind: 'constant',
  type,
  values: [value],
  position: token.position,
});

/** `;` where an operand stands: Godot's empty expression of type `void` (`shader_language.cpp:6778`). */
const emptyExpression = (token: Token): OperatorNode => ({
  kind: 'operator',
  type: 'void',
  op: 'OP_EMPTY',
  row: instruction('OP_EMPTY')!,
  operands: [],
  position: token.position,
});

/** `get_token_text` (`shader_language.cpp:237`): the token's name, and a number's value or an identifier. */
function tokenText(token: Token): string {
  const name = token.type.replace(/^TK_/, '');
  switch (token.type) {
    case 'TK_FLOAT_CONSTANT':
      return `${name}(${godotNumberText(godotStrtod(token.text!))})`;
    case 'TK_INT_CONSTANT':
    case 'TK_UINT_CONSTANT':
      return `${name}(${godotNumberText(godotIntegerConstant(token.text!))})`;
    case 'TK_IDENTIFIER':
      return `${name}(${token.text})`;
    default:
      return name;
  }
}
