/**
 * The parser of Godot's shading language: tokens to the typed tree, as Godot's `_parse_shader`
 * reads structs and functions (`shader_language.cpp:9314` and `:10258`) and `_parse_block` reads
 * their statements (`parseBlock.ts`). A form the transpiler does not read yet is refused with the
 * row that names it and the issue that owns it.
 */

import { builtInInstruction, instruction, keywordInstruction, notTranspiled } from './instructions.js';
import { StatementParser, type ScopeHolder } from './parseBlock.js';
import { ExpressionParser, type ExpressionScope } from './parseExpression.js';
import { BlockScope, type Identifier } from './scope.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import type {
  Argument,
  BlockNode,
  FunctionNode,
  ShaderNode,
  Statement,
  StructMember,
  StructNode,
} from './shaderTree.js';
import { TokenCursor } from './tokenCursor.js';
import type { Token } from './tokenizer.js';
import { shapeOf } from './types.js';

/** The tree of the tokens of a shader text. */
export function parse(tokens: readonly Token[]): ShaderNode {
  return new ShaderParser(new TokenCursor(tokens)).shader();
}

class ShaderParser implements ExpressionScope {
  private readonly structs: StructNode[] = [];
  private readonly functions: FunctionNode[] = [];
  /** The argument types of each function declared so far, its own included while its body is read. */
  private readonly signatures: { readonly name: string; readonly types: string }[] = [];
  private returnType = 'void';
  /** The block a statement is read in. Outside a body, an empty one. */
  private readonly holder: ScopeHolder = { current: new BlockScope(undefined, 'plain', []) };
  private readonly expressions: ExpressionParser;
  private readonly statements: StatementParser;

  constructor(private readonly tokens: TokenCursor) {
    this.expressions = new ExpressionParser(tokens, this);
    this.statements = new StatementParser(
      tokens,
      this.expressions,
      this.holder,
      (name) => this.struct(name) !== undefined,
      () => this.returnType
    );
  }

  identifier(name: string): Identifier | undefined {
    const found = this.holder.current.find(name, false);
    if (found) return found;
    return this.signatures.some((declared) => declared.name === name) ? { kind: 'function' } : undefined;
  }

  struct(name: string): StructNode | undefined {
    return this.structs.find((struct) => struct.name === name);
  }

  shader(): ShaderNode {
    for (;;) {
      const token = this.tokens.next();
      if (token.type === 'TK_EOF')
        return { kind: 'shader', structs: this.structs, functions: this.functions };
      if (token.type === 'TK_STRUCT') this.structs.push(this.structDefinition(token));
      else this.functions.push(this.functionDefinition(token));
    }
  }

  /** `struct Name { members };` (`shader_language.cpp:9314`). */
  private structDefinition(first: Token): StructNode {
    const nameToken = this.tokens.next();
    if (nameToken.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected a struct identifier.');
    const name = nameToken.text!;
    if (this.struct(name)) this.tokens.fail(`Redefinition of '${name}'.`);
    if (this.tokens.next().type !== 'TK_CURLY_BRACKET_OPEN') this.tokens.fail("Expected a '{'.");
    const members: StructMember[] = [];
    for (;;) {
      const token = this.tokens.next();
      if (token.type === 'TK_CURLY_BRACKET_CLOSE') break;
      members.push(...this.memberDeclaration(token, members));
    }
    if (members.length === 0) this.tokens.fail('Empty structs are not allowed.');
    if (this.tokens.next().type !== 'TK_SEMICOLON') this.tokens.fail("Expected a ';'.");
    return { kind: 'struct', name, members, position: first.position };
  }

  /** One line of members, `vec2 a, b[2];`, each name once in the struct. */
  private memberDeclaration(first: Token, declared: readonly StructMember[]): StructMember[] {
    if (first.type === 'TK_STRUCT') this.tokens.fail('Nested structs are not allowed.');
    const typeToken = this.precededType(first, () => this.tokens.fail('Expected data type.'));
    const type =
      typeToken.type === 'TK_IDENTIFIER' && this.struct(typeToken.text!)
        ? typeToken.text!
        : this.memberValueType(typeToken);
    const members: StructMember[] = [];
    let typeSize: number | undefined;
    for (;;) {
      let token = this.tokens.next();
      if (members.length === 0) {
        if (token.type !== 'TK_IDENTIFIER' && token.type !== 'TK_BRACKET_OPEN')
          this.tokens.fail("Expected an identifier or '['.");
        if (token.type === 'TK_BRACKET_OPEN') {
          typeSize = this.expressions.arrays.size(true);
          token = this.tokens.next();
        }
      }
      if (token.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected an identifier.');
      const name = token.text!;
      if ([...declared, ...members].some((member) => member.name === name))
        this.tokens.fail(`Redefinition of '${name}'.`);
      const arraySize = this.tokens.accept('TK_BRACKET_OPEN') ? this.expressions.arrays.size(true) : typeSize;
      members.push({ name, type, ...(arraySize !== undefined ? { arraySize } : {}) });
      const end = this.tokens.next();
      if (end.type === 'TK_SEMICOLON') return members;
      if (end.type !== 'TK_COMMA') this.tokens.fail("Expected a ',' or ';'.");
    }
  }

  /** A member's value type: Godot refuses `void` and the samplers there. */
  private memberValueType(token: Token): string {
    const row = keywordInstruction(token.type);
    if (row?.family !== 'data type') this.tokens.fail('Expected data type.');
    if (shapeOf(row.id) === undefined) this.tokens.fail(`A '${row.id}' data type is not allowed here.`);
    return row.id;
  }

  /** A function, from its return type (`shader_language.cpp:10258`). */
  private functionDefinition(first: Token): FunctionNode {
    const typeToken = this.precededType(first, () => this.refuseGlobal(first));
    if (typeToken.type === 'TK_IDENTIFIER' && this.struct(typeToken.text!))
      throw notTranspiled(instruction('OP_CALL')!, typeToken.position, `a function of ${typeToken.text}`);
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
    const args = this.argumentList();
    this.returnType = returnType;
    this.declare(name, args, nameToken);
    this.tokens.expect('TK_CURLY_BRACKET_OPEN', "Expected a '{' to begin function.");
    const body = this.statements.body(args, this.tokens.lastPosition());
    if (returnType !== 'void' && !hasReturn(body)) {
      this.tokens.fail("Expected at least one 'return' statement in a non-void function.");
    }
    return { kind: 'function', name, returnType, arguments: args, body, position: first.position };
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
    if (typeToken.type === 'TK_IDENTIFIER' && this.struct(typeToken.text!))
      throw notTranspiled(instruction('OP_CALL')!, typeToken.position, `an argument of ${typeToken.text}`);
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
  private declare(name: string, args: readonly Argument[], token: Token): void {
    const types = args.map((argument) => argument.type).join(',');
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
}

const isPrecisionToken = (type: string) => type.startsWith('TK_PRECISION_');

/**
 * Whether a `return` stands anywhere in `block`, searched from its last statement into every
 * flow's blocks, as `_find_last_flow_op_in_block` searches (`shader_language.cpp:11088`).
 */
function hasReturn(block: BlockNode): boolean {
  return block.statements.some((statement: Statement) => {
    if (statement.kind === 'block') return hasReturn(statement);
    if (statement.kind !== 'control flow') return false;
    return statement.flow === 'FLOW_OP_RETURN' || statement.blocks.some(hasReturn);
  });
}
