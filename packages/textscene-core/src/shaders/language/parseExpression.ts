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
import type { ShadingLanguageError } from './shadingLanguageError.js';
import type { Argument, ConstantNode, Expression, OperatorNode, Scalar } from './shaderTree.js';
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

/** What an identifier names where the expression stands. */
export interface ExpressionScope {
  argument(name: string): Argument | undefined;
  isFunction(name: string): boolean;
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
  constructor(
    private readonly tokens: TokenCursor,
    private readonly scope: ExpressionScope
  ) {}

  /** How many lists `unreducedExpression` reads at once: brackets, arguments and ternary parts. */
  private nesting = 0;

  /** `_parse_and_reduce_expression` (`shader_language.cpp:7949`). */
  expression(): Expression {
    return reduced(this.unreducedExpression());
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
        throw notTranspiled(instruction('NODE_TYPE_ARRAY_CONSTRUCT')!, token.position);
      case 'TK_IDENTIFIER':
        return this.identifier(token);
      case 'TK_OP_ADD':
        return undefined;
      case 'TK_SEMICOLON':
        this.tokens.reset(mark);
        return emptyExpression(token);
    }
    if (isDataTypeToken(token.type)) return this.construction(token);
    this.tokens.fail(`Expected expression, found: '${tokenText(token)}'.`);
  }

  /** A constructor, `vec3(a, 1.0)` (`shader_language.cpp:6046`), folded when its arguments are constants. */
  private construction(typeToken: Token): Expression {
    const type = keywordInstruction(typeToken.type)!.id;
    const token = this.tokens.next();
    if (token.type === 'TK_BRACKET_OPEN')
      throw notTranspiled(instruction('NODE_TYPE_ARRAY_CONSTRUCT')!, token.position);
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

  /** A read of an argument, or the refusal of a call or a built-in the transpiler does not read yet. */
  private identifier(token: Token): Expression {
    const name = token.text!;
    if (this.tokens.peek().type === 'TK_PARENTHESIS_OPEN') {
      this.tokens.next();
      throw this.refusedCall(name, this.argumentList(), token);
    }
    const argument = this.scope.argument(name);
    if (argument) return { kind: 'variable', type: argument.type, name, position: token.position };
    if (this.scope.isFunction(name)) this.tokens.fail(`Can't use function as identifier: '${name}'.`);
    const builtIn = builtInInstruction(name);
    if (builtIn) throw notTranspiled(builtIn, token.position, name);
    this.tokens.fail(`Unknown identifier in expression: '${name}'.`);
  }

  /** A call: a built-in function's overload row, or `OP_CALL` for a function of the shader. */
  private refusedCall(name: string, args: readonly Expression[], token: Token): ShadingLanguageError {
    const overload = signatureInstruction(
      name,
      args.map((arg) => arg.type)
    );
    if (overload) return notTranspiled(overload, token.position);
    const anyOverload = firstInstruction(`${name}(`);
    if (anyOverload) return notTranspiled(anyOverload, token.position, name);
    if (this.scope.isFunction(name)) return notTranspiled(instruction('OP_CALL')!, token.position);
    this.tokens.fail(`Unknown identifier in expression: '${name}'.`);
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

  private member(owner: Expression): Expression {
    const token = this.tokens.next();
    if (token.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected an identifier as a member.');
    const member = swizzled(owner, token.text!);
    if (typeof member === 'string') this.tokens.fail(member);
    return member;
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
