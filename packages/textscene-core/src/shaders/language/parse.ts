/**
 * The parser of Godot's shading language: tokens to the typed tree, with Godot's type rules read
 * from the instruction table. It reads what the transpiler transpiles (functions that return one
 * expression of float arithmetic) and refuses the rest, naming the row and the issue that owns it.
 */

import {
  builtInInstruction,
  familyInstructions,
  firstInstruction,
  instruction,
  keywordInstruction,
  notTranspiled,
  signatureInstruction,
} from './instructions.js';
import {
  BINARY_BY_TOKEN,
  BINARY_LEVEL_COUNT,
  BINARY_OPERATORS,
  operatorText,
  type TranspiledOperator,
} from './operators.js';
import type { InstructionRow } from './instructionTable.generated.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import type { Expression, FunctionDefinition, Parameter, ShaderTree, ValueType } from './shaderTree.js';
import type { Token } from './tokenizer.js';
import { godotLiteralFloat } from './godotNumber.js';

/** The types the transpiler reads. Each other type is refused with the row that names it. */
const TRANSPILED_TYPES: ReadonlySet<ValueType> = new Set(['float', 'vec2', 'vec3', 'vec4']);

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
  /** The parameter types of each function read so far, by name. */
  private readonly functionSignatures = new Map<string, string>();

  constructor(private readonly tokens: readonly Token[]) {}

  shader(): ShaderTree {
    const functions: FunctionDefinition[] = [];
    while (this.peek().type !== 'TK_EOF') functions.push(this.functionDefinition());
    return { functions };
  }

  private functionDefinition(): FunctionDefinition {
    const returnType = this.type();
    const nameToken = this.peek();
    const name = this.identifier('Expected a function name after type.');
    this.expect('TK_PARENTHESIS_OPEN', "Expected '(' after function identifier.");
    this.parameters = this.parameterList();
    this.declareFunction(name, nameToken);
    this.expect('TK_CURLY_BRACKET_OPEN', "Expected '{' to begin function.");
    const result = this.returnStatement(returnType);
    if (!this.accept('TK_CURLY_BRACKET_CLOSE')) this.refuseStatement();
    return { name, returnType, parameters: this.parameters, result };
  }

  private parameterList(): Parameter[] {
    const parameters: Parameter[] = [];
    if (this.accept('TK_PARENTHESIS_CLOSE')) return parameters;
    do {
      const type = this.type();
      const nameToken = this.peek();
      const name = this.identifier('Expected an identifier for argument name.');
      if (parameters.some((parameter) => parameter.name === name)) {
        this.fail(`Redefinition of '${name}'.`, nameToken);
      }
      parameters.push({ type, name });
    } while (this.accept('TK_COMMA'));
    this.expect('TK_PARENTHESIS_CLOSE', "Expected ',' or ')' after argument.");
    return parameters;
  }

  /**
   * Records function `name` with the parameters just read. Godot refuses a second function of the
   * same parameter types (`shader_language.cpp:10954`). It accepts an overload, which the
   * transpiler refuses: it keys the functions it gives by name.
   */
  private declareFunction(name: string, token: Token): void {
    const signature = this.parameters.map((parameter) => parameter.type).join(',');
    const declared = this.functionSignatures.get(name);
    if (declared === signature) this.fail(`Redefinition of '${name}'.`, token);
    if (declared !== undefined) {
      const owner = instruction('OP_CALL')!.owner;
      throw new ShadingLanguageError(`An overload of '${name}' is not transpiled yet (${owner})`, token.line);
    }
    this.functionSignatures.set(name, signature);
  }

  private returnStatement(returnType: ValueType): Expression {
    if (!this.accept('TK_CF_RETURN')) this.refuseStatement();
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
    throw notTranspiled(row ?? instruction(declaration)!, token.line);
  }

  /** A type keyword the transpiler reads, or the refusal of the keyword's row. */
  private type(): ValueType {
    const token = this.next();
    return this.transpiledType(token, `Expected a type, found: '${token.text ?? token.type}'.`);
  }

  private expression(): Expression {
    return this.binary(BINARY_LEVEL_COUNT - 1);
  }

  /** Left to right at each level, as Godot's priority loop reduces (`shader_language.cpp:7600`). */
  private binary(level: number): Expression {
    const operand = () => (level === 0 ? this.unary() : this.binary(level - 1));
    let left = operand();
    for (;;) {
      const token = this.peek();
      const op = BINARY_BY_TOKEN.get(token.type);
      if (op && BINARY_OPERATORS[op].level === level) {
        this.next();
        left = this.operator(op, [left, operand()], token);
      } else if (!op && isOperatorToken(token.type)) {
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
  private operator(op: TranspiledOperator, operands: Expression[], token: Token): Expression {
    const types = typesOf(operands);
    const row = signatureInstruction(op, types);
    if (!row) this.fail(`Invalid arguments to operator '${operatorText(op)}': '${types.join(', ')}'.`, token);
    if (!TRANSPILED_TYPES.has(row.returns!)) throw notTranspiled(row, token.line);
    return { kind: 'operator', type: row.returns!, row, operands };
  }

  /** An operator the transpiler does not read: its exact row, or the operator's name. */
  private refuseOperator(op: string, operands: Expression[], token: Token): never {
    const row = signatureInstruction(op, typesOf(operands));
    if (row) throw notTranspiled(row, token.line);
    throw notTranspiled(instruction(op) ?? firstInstruction(`${op}(`)!, token.line, op);
  }

  private postfix(base: Expression): Expression {
    let node = base;
    for (;;) {
      const token = this.peek();
      if (token.type === 'TK_PERIOD') {
        this.next();
        node = this.swizzle(node, this.identifier('Expected an identifier as a member.'), token);
      } else if (token.type === 'TK_BRACKET_OPEN') throw notTranspiled(instruction('OP_INDEX')!, token.line);
      else if (token.type === 'TK_OP_INCREMENT' || token.type === 'TK_OP_DECREMENT') {
        throw notTranspiled(firstInstruction(`OP_POST_${token.type.slice(6)}(`)!, token.line);
      } else return node;
    }
  }

  private primary(): Expression {
    const token = this.next();
    switch (token.type) {
      case 'TK_FLOAT_CONSTANT':
        return { kind: 'float literal', type: 'float', value: this.literalFloat(token) };
      case 'TK_INT_CONSTANT':
        throw notTranspiled(instruction('int literal')!, token.line);
      case 'TK_UINT_CONSTANT':
        throw notTranspiled(instruction('uint literal')!, token.line);
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
    const type = this.transpiledType(token, `Expected expression, found: '${token.text ?? token.type}'.`);
    this.expect('TK_PARENTHESIS_OPEN', "Expected '(' after the type name.");
    const args = this.argumentList();
    const overload = signatureInstruction(type, typesOf(args));
    if (!overload) this.fail(`No matching constructor found for: '${type}'.`, token);
    return { kind: 'constructor', type, row: overload, args };
  }

  /** The type of a type keyword the transpiler reads, the refusal of its row, or Godot's `message`. */
  private transpiledType(token: Token, message: string): ValueType {
    const row = keywordInstruction(token.type);
    if (!row) this.fail(message, token);
    if (row.family !== 'data type' || !TRANSPILED_TYPES.has(row.id)) throw notTranspiled(row, token.line);
    return row.id;
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
    if (builtIn) throw notTranspiled(builtIn, token.line, name);
    this.fail(`Unknown identifier in expression: '${name}'.`, token);
  }

  /** A call: a built-in function's overload row, or `OP_CALL` for a function of the shader. */
  private refuseCall(name: string, args: readonly Expression[], token: Token): ShadingLanguageError {
    const overload = signatureInstruction(name, typesOf(args));
    if (overload) return notTranspiled(overload, token.line);
    const anyOverload = firstInstruction(`${name}(`);
    if (anyOverload) return notTranspiled(anyOverload, token.line, name);
    if (this.functionSignatures.has(name)) return notTranspiled(instruction('OP_CALL')!, token.line);
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

  /** The next token, which must be `type`; otherwise Godot's `message` is thrown. */
  private expect(type: string, message: string): void {
    if (!this.accept(type)) this.fail(message);
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

const typesOf = (expressions: readonly Expression[]) => expressions.map((expression) => expression.type);

const SWIZZLE_ROWS = familyInstructions('swizzle');

/** The swizzle rows of `type`, one per letter set: `vec3.xyz`, `vec3.rgb`, `vec3.stp`. */
function swizzleRows(type: ValueType): InstructionRow[] {
  return SWIZZLE_ROWS.filter((row) => row.id.startsWith(`${type}.`));
}

const setLetters = (row: InstructionRow) => row.id.slice(row.id.indexOf('.') + 1);
