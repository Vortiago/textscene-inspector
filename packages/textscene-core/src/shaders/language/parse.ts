/**
 * The parser of Godot's shading language: tokens to the typed tree, as Godot's `_parse_shader`
 * reads functions (`shader_language.cpp:10258`) and `_parse_block` reads their statements
 * (`shader_language.cpp:7960`). A form the transpiler does not read yet is refused with the row
 * that names it and the issue that owns it.
 */

import { builtInInstruction, instruction, keywordInstruction, notTranspiled } from './instructions.js';
import { ExpressionParser, type ExpressionScope } from './parseExpression.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import type {
  Argument,
  BlockNode,
  ControlFlowNode,
  FunctionNode,
  ShaderNode,
  Statement,
} from './shaderTree.js';
import { TokenCursor } from './tokenCursor.js';
import type { Token } from './tokenizer.js';
import { shapeOf } from './types.js';

/** The tree of the tokens of a shader text. */
export function parse(tokens: readonly Token[]): ShaderNode {
  return new ShaderParser(new TokenCursor(tokens)).shader();
}

class ShaderParser implements ExpressionScope {
  private readonly functions: FunctionNode[] = [];
  /** The argument types of each function declared so far, its own included while its body is read. */
  private readonly signatures: { readonly name: string; readonly types: string }[] = [];
  private arguments: readonly Argument[] = [];
  private returnType = 'void';
  private readonly expressions: ExpressionParser;

  constructor(private readonly tokens: TokenCursor) {
    this.expressions = new ExpressionParser(tokens, this);
  }

  argument(name: string): Argument | undefined {
    return this.arguments.find((argument) => argument.name === name);
  }

  isFunction(name: string): boolean {
    return this.signatures.some((declared) => declared.name === name);
  }

  shader(): ShaderNode {
    for (;;) {
      const token = this.tokens.next();
      if (token.type === 'TK_EOF') return { kind: 'shader', functions: this.functions };
      this.functions.push(this.functionDefinition(token));
    }
  }

  /** A function, from its return type (`shader_language.cpp:10258`). */
  private functionDefinition(first: Token): FunctionNode {
    const typeToken = this.precededType(first, () => this.refuseGlobal(first));
    if (keywordInstruction(typeToken.type)?.family !== 'data type') this.refuseGlobal(typeToken);
    const returnType = this.dataType(typeToken);
    if (shapeOf(returnType) === undefined && returnType !== 'void') {
      this.tokens.fail('Invalid function type (samplers are not allowed).');
    }
    if (this.tokens.peek().type === 'TK_BRACKET_OPEN')
      throw notTranspiled(instruction('NODE_TYPE_ARRAY')!, this.tokens.peek().position);
    const nameToken = this.tokens.next();
    if (nameToken.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected a function name after type.');
    const name = nameToken.text!;
    if (builtInInstruction(name)) this.tokens.fail(`Redefinition of '${name}'.`);
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN') {
      if (returnType === 'void') this.tokens.fail("Expected '(' after function identifier.");
      throw notTranspiled(keywordInstruction('TK_CONST')!, nameToken.position);
    }
    this.arguments = this.argumentList();
    this.returnType = returnType;
    this.declare(name, nameToken);
    this.tokens.expect('TK_CURLY_BRACKET_OPEN', "Expected a '{' to begin function.");
    const body = this.block(this.tokens.lastPosition());
    if (returnType !== 'void' && !body.statements.some(isReturn)) {
      this.tokens.fail("Expected at least one 'return' statement in a non-void function.");
    }
    return { kind: 'function', name, returnType, arguments: this.arguments, body, position: first.position };
  }

  /**
   * The type token after an optional precision, which Godot checks against the type
   * (`_validate_precision`, `shader_language.cpp:9117`). `refuse` handles a `const` first.
   */
  private precededType(first: Token, refuse: () => never): Token {
    if (first.type === 'TK_CONST') refuse();
    if (!isPrecisionToken(first.type)) return first;
    const typeToken = this.tokens.next();
    const shape = shapeOf(keywordInstruction(typeToken.type)?.id ?? '');
    if (shape?.scalar === 'bool') this.tokens.fail('The precision modifier cannot be used on boolean types.');
    return typeToken;
  }

  /** A global that is not a function: the row of its keyword, or Godot's message. */
  private refuseGlobal(token: Token): never {
    const row = keywordInstruction(token.type);
    if (row && row.family !== 'data type') throw notTranspiled(row, token.position);
    this.tokens.fail('Expected constant, function, uniform or varying.');
  }

  private dataType(token: Token): string {
    return keywordInstruction(token.type)!.id;
  }

  /** The arguments after `(`, up to `)`; Godot accepts a `,` before the `)` (`shader_language.cpp:10704`). */
  private argumentList(): Argument[] {
    const args: Argument[] = [];
    let token = this.tokens.next();
    while (token.type !== 'TK_PARENTHESIS_CLOSE') {
      args.push(this.argumentDeclaration(token, args));
      token = this.tokens.next();
      if (token.type === 'TK_COMMA') token = this.tokens.next();
      else if (token.type !== 'TK_PARENTHESIS_CLOSE') this.tokens.fail("Expected a ',' or ')'.");
    }
    return args;
  }

  private argumentDeclaration(first: Token, declared: readonly Argument[]): Argument {
    const qualifier = keywordInstruction(first.type);
    if (first.type === 'TK_CONST' || (qualifier?.family === 'qualifier' && !isPrecisionToken(first.type))) {
      throw notTranspiled(qualifier!, first.position);
    }
    const typeToken = this.precededType(first, () =>
      this.tokens.fail('Expected a valid data type for argument.')
    );
    if (keywordInstruction(typeToken.type)?.family !== 'data type' || typeToken.type === 'TK_STRUCT') {
      this.tokens.fail('Expected a valid data type for argument.');
    }
    const type = this.dataType(typeToken);
    if (type === 'void') this.tokens.fail('Void type not allowed as argument.');
    const nameToken = this.tokens.next();
    if (nameToken.type === 'TK_BRACKET_OPEN')
      throw notTranspiled(instruction('NODE_TYPE_ARRAY')!, nameToken.position);
    if (nameToken.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected an identifier for argument name.');
    const name = nameToken.text!;
    if (declared.some((argument) => argument.name === name) || builtInInstruction(name)) {
      this.tokens.fail(`Redefinition of '${name}'.`);
    }
    if (this.tokens.peek().type === 'TK_BRACKET_OPEN')
      throw notTranspiled(instruction('NODE_TYPE_ARRAY')!, this.tokens.peek().position);
    return { name, type, position: nameToken.position };
  }

  /**
   * Records function `name` with the arguments just read. Godot refuses a second function of the
   * same argument types (`shader_language.cpp:10921`). It accepts an overload, which the transpiler
   * refuses: it keys the functions it gives by name.
   */
  private declare(name: string, token: Token): void {
    const types = this.arguments.map((argument) => argument.type).join(',');
    const overloads = this.signatures.filter((declared) => declared.name === name);
    if (overloads.some((declared) => declared.types === types))
      this.tokens.fail(`Redefinition of '${name}'.`);
    if (overloads.length > 0) {
      const owner = instruction('OP_CALL')!.owner;
      throw new ShadingLanguageError(
        `An overload of '${name}' is not transpiled yet (${owner})`,
        token.position,
        owner
      );
    }
    this.signatures.push({ name, types });
  }

  /** The statements up to `}` (`_parse_block`). */
  private block(position: Token['position']): BlockNode {
    const statements: Statement[] = [];
    for (;;) {
      const mark = this.tokens.mark();
      const token = this.tokens.next();
      if (token.type === 'TK_CURLY_BRACKET_CLOSE') return { kind: 'block', statements, position };
      if (token.type === 'TK_CF_RETURN') statements.push(this.returnStatement(token));
      else {
        this.refuseStatement(token);
        this.tokens.reset(mark);
        statements.push(this.expressionStatement());
      }
    }
  }

  /** A declaration, a nested block or a flow keyword: the row that names it. */
  private refuseStatement(token: Token): void {
    const row = keywordInstruction(token.type);
    if (
      token.type === 'TK_CONST' ||
      isPrecisionToken(token.type) ||
      (row?.family === 'data type' && token.type !== 'TK_TYPE_VOID')
    ) {
      throw notTranspiled(instruction('NODE_TYPE_VARIABLE_DECLARATION')!, token.position);
    }
    if (token.type === 'TK_CURLY_BRACKET_OPEN')
      throw notTranspiled(instruction('NODE_TYPE_BLOCK')!, token.position);
    if (row?.family === 'statement keyword') throw notTranspiled(row, token.position);
  }

  /** `return`, with an expression of the function's type (`shader_language.cpp:8852`). */
  private returnStatement(token: Token): ControlFlowNode {
    const returnType = this.returnType;
    const flow = { kind: 'control flow', flow: 'FLOW_OP_RETURN', position: token.position } as const;
    const mark = this.tokens.mark();
    if (this.tokens.next().type === 'TK_SEMICOLON') {
      if (returnType !== 'void')
        this.tokens.fail(`Expected 'return' with an expression of type '${returnType}'.`);
      return { ...flow, expressions: [] };
    }
    if (returnType === 'void') this.tokens.fail("'void' function cannot return a value.");
    this.tokens.reset(mark);
    const expression = this.expressions.expression();
    if (expression.type !== returnType)
      this.tokens.fail(`Expected return with an expression of type '${returnType}'.`);
    this.tokens.expect('TK_SEMICOLON', "Expected a ';' after 'return'.");
    return { ...flow, expressions: [expression] };
  }

  /** An expression and its `;` (`shader_language.cpp:9016`). */
  private expressionStatement(): Statement {
    const expression = this.expressions.expression();
    this.tokens.expect('TK_SEMICOLON', "Expected a ';'.");
    return expression;
  }
}

const isPrecisionToken = (type: string) => type.startsWith('TK_PRECISION_');

const isReturn = (statement: Statement) =>
  statement.kind === 'control flow' && statement.flow === 'FLOW_OP_RETURN';
