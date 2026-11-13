/**
 * The parser of Godot's shading language: tokens to the typed tree, with Godot's type rules read
 * from the instruction table. It reads what the translator translates (functions that return one
 * expression of float arithmetic) and refuses the rest, naming the row and the issue that owns it.
 */

import {
  builtInInstruction,
  familyInstructions,
  firstInstruction,
  instruction,
  keywordInstruction,
  notTranslated,
} from './instructions.js';
import type { InstructionRow } from './instructionTable.generated.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import type { Expression, FunctionDefinition, Parameter, ShaderTree, ValueType } from './shaderTree.js';
import type { Token } from './tokenizer.js';
import { godotLiteralFloat } from './godotNumber.js';

/** The types the translator reads. Each other type is refused with the row that names it. */
const TRANSLATED_TYPES: ReadonlySet<ValueType> = new Set(['float', 'vec2', 'vec3', 'vec4']);

/** The binary operators the translator reads, by token, tightest first (`shader_language.cpp:7600`). */
const BINARY_LEVELS: readonly (readonly string[])[] = [
  ['TK_OP_MUL', 'TK_OP_DIV'],
  ['TK_OP_ADD', 'TK_OP_SUB'],
];

const BINARY_TOKENS: ReadonlySet<string> = new Set(BINARY_LEVELS.flat());

/** Godot's `get_operator_text` (`shader_language.cpp:44`) for the operators the translator reads. */
const OPERATOR_TEXT: Readonly<Record<string, string>> = {
  OP_ADD: '+',
  OP_SUB: '-',
  OP_MUL: '*',
  OP_DIV: '/',
};

/** Godot's operator enumerator of an operator token: `TK_OP_ADD` is `OP_ADD`, `?` is `OP_SELECT_IF`. */
const operatorOf = (token: string) => (token === 'TK_QUESTION' ? 'OP_SELECT_IF' : token.replace(/^TK_/, ''));

const isOperatorToken = (token: string) => token.startsWith('TK_OP_') || token === 'TK_QUESTION';

/** The tree of the tokens of a shader text. */
export function parse(tokens: readonly Token[]): ShaderTree {
  return new Parser(tokens).shader();
}

class Parser {
  private position = 0;
  private parameters: readonly Parameter[] = [];
  private readonly functionNames = new Set<string>();

  constructor(private readonly tokens: readonly Token[]) {}

  shader(): ShaderTree {
    const functions: FunctionDefinition[] = [];
    while (this.peek().type !== 'TK_EOF') functions.push(this.functionDefinition());
    return { functions };
  }

  private functionDefinition(): FunctionDefinition {
    const returnType = this.type();
    const name = this.identifier('Expected a function name after type.');
    this.functionNames.add(name);
    this.expect('TK_PARENTHESIS_OPEN', "Expected '(' after function identifier.");
    this.parameters = this.parameterList();
    this.expect('TK_CURLY_BRACKET_OPEN', "Expected '{' to begin function.");
    const result = this.returnStatement(returnType);
    this.expect('TK_CURLY_BRACKET_CLOSE', '', () => this.refuseStatement());
    return { name, returnType, parameters: this.parameters, result };
  }

  private parameterList(): Parameter[] {
    const parameters: Parameter[] = [];
    if (this.accept('TK_PARENTHESIS_CLOSE')) return parameters;
    do {
      const type = this.type();
      parameters.push({ type, name: this.identifier('Expected an identifier for argument name.') });
    } while (this.accept('TK_COMMA'));
    this.expect('TK_PARENTHESIS_CLOSE', "Expected ',' or ')' after argument.");
    return parameters;
  }

  private returnStatement(returnType: ValueType): Expression {
    this.expect('TK_CF_RETURN', '', () => this.refuseStatement());
    const result = this.expression();
    if (result.type !== returnType) this.fail(`Expected return with an expression of type '${returnType}'.`);
    this.expect('TK_SEMICOLON', "Expected ';' after return expression.");
    return result;
  }

  /** A statement other than the one `return`: Godot's tree node or keyword row for it. */
  private refuseStatement(): never {
    const token = this.peek();
    const keyword = keywordInstruction(token.type);
    const row = keyword?.family === 'statement keyword' ? keyword : undefined;
    const declaration = token.type.startsWith('TK_TYPE_')
      ? 'NODE_TYPE_VARIABLE_DECLARATION'
      : 'NODE_TYPE_BLOCK';
    throw notTranslated(row ?? instruction(declaration)!, token.line);
  }

  /** A type keyword the translator reads, or the refusal of the keyword's row. */
  private type(): ValueType {
    const token = this.next();
    const row = keywordInstruction(token.type);
    if (!row) this.fail(`Expected a type, found: '${token.text ?? token.type}'.`, token);
    if (row.family !== 'data type' || !TRANSLATED_TYPES.has(row.id)) throw notTranslated(row, token.line);
    return row.id;
  }

  private expression(): Expression {
    return this.binary(BINARY_LEVELS.length - 1);
  }

  /** Left to right at each level, as Godot's priority loop reduces (`shader_language.cpp:7600`). */
  private binary(level: number): Expression {
    const operand = () => (level === 0 ? this.unary() : this.binary(level - 1));
    let left = operand();
    for (;;) {
      const token = this.peek();
      if (BINARY_LEVELS[level]!.includes(token.type)) {
        this.next();
        left = this.operator(operatorOf(token.type), [left, operand()], token);
      } else if (isOperatorToken(token.type) && !BINARY_TOKENS.has(token.type)) {
        this.next();
        this.refuseOperator(operatorOf(token.type), [left, this.unary()], token);
      } else return left;
    }
  }

  private unary(): Expression {
    const token = this.peek();
    if (token.type === 'TK_OP_SUB') {
      this.next();
      return this.operator('OP_NEGATE', [this.unary()], token);
    }
    if (isOperatorToken(token.type)) {
      this.next();
      this.refuseOperator(operatorOf(token.type), [this.unary()], token);
    }
    return this.postfix(this.primary());
  }

  /** The operator node of `op` over `operands`, typed by its row, or Godot's refusal. */
  private operator(op: string, operands: Expression[], token: Token): Expression {
    const row = instruction(`${op}(${operands.map((operand) => operand.type).join(',')})`);
    if (!row) {
      const types = operands.map((operand) => operand.type).join(', ');
      this.fail(`Invalid arguments to operator '${OPERATOR_TEXT[op] ?? '-'}': '${types}'.`, token);
    }
    if (!TRANSLATED_TYPES.has(row.returns!)) throw notTranslated(row, token.line);
    return { kind: 'operator', type: row.returns!, row, operands };
  }

  /** An operator the translator does not read: its exact row, or the operator's name. */
  private refuseOperator(op: string, operands: Expression[], token: Token): never {
    const row = instruction(`${op}(${operands.map((operand) => operand.type).join(',')})`);
    if (row) throw notTranslated(row, token.line);
    throw notTranslated(instruction(op) ?? firstInstruction(`${op}(`)!, token.line, op);
  }

  private postfix(base: Expression): Expression {
    let node = base;
    for (;;) {
      const token = this.peek();
      if (token.type === 'TK_PERIOD') {
        this.next();
        node = this.swizzle(node, this.identifier('Expected an identifier as a member.'), token);
      } else if (token.type === 'TK_BRACKET_OPEN') throw notTranslated(instruction('OP_INDEX')!, token.line);
      else if (token.type === 'TK_OP_INCREMENT' || token.type === 'TK_OP_DECREMENT') {
        throw notTranslated(firstInstruction(`OP_POST_${token.type.slice(6)}(`)!, token.line);
      } else return node;
    }
  }

  private primary(): Expression {
    const token = this.next();
    switch (token.type) {
      case 'TK_FLOAT_CONSTANT':
        return { kind: 'float literal', type: 'float', value: this.literalFloat(token) };
      case 'TK_INT_CONSTANT':
        throw notTranslated(instruction('int literal')!, token.line);
      case 'TK_UINT_CONSTANT':
        throw notTranslated(instruction('uint literal')!, token.line);
      case 'TK_PARENTHESIS_OPEN': {
        const inner = this.expression();
        this.expect('TK_PARENTHESIS_CLOSE', "Expected ')' in expression.");
        return inner;
      }
      case 'TK_IDENTIFIER':
        return this.identifierExpression(token);
      default:
        return this.keywordExpression(token);
    }
  }

  /** A constructor, after its type keyword, or the refusal of the keyword's row. */
  private keywordExpression(token: Token): Expression {
    const row = keywordInstruction(token.type);
    if (!row) this.fail(`Expected expression, found: '${token.text ?? token.type}'.`, token);
    if (row.family !== 'data type' || !TRANSLATED_TYPES.has(row.id)) throw notTranslated(row, token.line);
    this.expect('TK_PARENTHESIS_OPEN', "Expected '(' after the type name.");
    const args = this.argumentList();
    const overload = instruction(`${row.id}(${args.map((arg) => arg.type).join(',')})`);
    if (!overload) this.fail(`No matching constructor found for: '${row.id}'.`, token);
    return { kind: 'constructor', type: row.id, row: overload, args };
  }

  private identifierExpression(token: Token): Expression {
    const name = token.text!;
    if (this.peek().type === 'TK_PARENTHESIS_OPEN') {
      this.next();
      throw this.refuseCall(name, this.argumentList(), token);
    }
    const index = this.parameters.findIndex((parameter) => parameter.name === name);
    if (index >= 0) return { kind: 'parameter', type: this.parameters[index]!.type, index };
    const builtIn = builtInInstruction(name);
    if (builtIn) throw notTranslated(builtIn, token.line, name);
    this.fail(`Unknown identifier in expression: '${name}'.`, token);
  }

  /** A call: a built-in function's overload row, or `OP_CALL` for a function of the shader. */
  private refuseCall(name: string, args: readonly Expression[], token: Token): ShadingLanguageError {
    const overload = instruction(`${name}(${args.map((arg) => arg.type).join(',')})`);
    if (overload) return notTranslated(overload, token.line);
    const anyOverload = firstInstruction(`${name}(`);
    if (anyOverload) return notTranslated(anyOverload, token.line, name);
    if (this.functionNames.has(name)) return notTranslated(instruction('OP_CALL')!, token.line);
    return new ShadingLanguageError(`Unknown identifier in expression: '${name}'.`, token.line);
  }

  private argumentList(): Expression[] {
    const args: Expression[] = [];
    if (this.accept('TK_PARENTHESIS_CLOSE')) return args;
    do args.push(this.expression());
    while (this.accept('TK_COMMA'));
    this.expect('TK_PARENTHESIS_CLOSE', "Expected ',' or ')' after argument.");
    return args;
  }

  /** Godot's swizzle rules (`shader_language.cpp:6890-7090`), with each type's letter sets from its rows. */
  private swizzle(base: Expression, letters: string, token: Token): Expression {
    const sets = swizzleRows(base.type);
    const invalid = `Invalid member for '${base.type}' expression: '.${letters}'.`;
    if (sets.length === 0 || letters.length > 4) this.fail(invalid, token);
    const setOf = (letter: string) => sets.find((row) => setLetters(row).includes(letter));
    const known = [...letters].map(setOf).filter((row) => row !== undefined);
    if (new Set(known).size > 1) {
      this.fail(`Cannot combine symbols from different sets in expression '.${letters}'.`, token);
    }
    const row = known[0];
    if (!row || known.length !== letters.length) this.fail(invalid, token);
    const lanes = [...letters].map((letter) => setLetters(row).indexOf(letter));
    const type = lanes.length === 1 ? 'float' : `vec${lanes.length}`;
    return { kind: 'swizzle', type, row, base, lanes };
  }

  /** The float a literal draws with, or the refusal of one whose text no GLSL compiler reads. */
  private literalFloat(token: Token): number {
    try {
      return godotLiteralFloat(token.text!);
    } catch (error) {
      this.fail(`float literal '${token.text}': ${(error as Error).message}`, token);
    }
  }

  private peek(): Token {
    return this.tokens[this.position]!;
  }

  private next(): Token {
    const token = this.peek();
    if (token.type !== 'TK_EOF') this.position += 1;
    return token;
  }

  private accept(type: string): boolean {
    if (this.peek().type !== type) return false;
    this.next();
    return true;
  }

  /** The next token, which must be `type`; otherwise `refuse` runs, or Godot's `message` is thrown. */
  private expect(type: string, message: string, refuse?: () => never): void {
    if (this.accept(type)) return;
    if (refuse) refuse();
    this.fail(message);
  }

  private identifier(message: string): string {
    const token = this.next();
    if (token.type !== 'TK_IDENTIFIER') this.fail(message, token);
    return token.text!;
  }

  private fail(message: string, token: Token = this.peek()): never {
    throw new ShadingLanguageError(message, token.line);
  }
}

const SWIZZLE_ROWS = familyInstructions('swizzle');

/** The swizzle rows of `type`, one per letter set: `vec3.xyz`, `vec3.rgb`, `vec3.stp`. */
function swizzleRows(type: ValueType): InstructionRow[] {
  return SWIZZLE_ROWS.filter((row) => row.id.startsWith(`${type}.`));
}

const setLetters = (row: InstructionRow) => row.id.slice(row.id.indexOf('.') + 1);
