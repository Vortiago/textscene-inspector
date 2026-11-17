import { builtInInstruction, keywordInstruction } from './instructions.js';
import type { ArraySize } from './parseArray.js';
import type { ExpressionParser } from './parseExpression.js';
import { arraySizeOf, typeName } from './treeWalk.js';
import type { BlockScope } from './scope.js';
import type { ArrayConstructNode, DeclarationNode, Declarator, Expression } from './shaderTree.js';
import type { TokenCursor } from './tokenCursor.js';
import type { Token } from './tokenizer.js';
import { shapeOf } from './types.js';

/** The declaration that starts at `first`, its `;` read. */
export function parseDeclaration(
  first: Token,
  tokens: TokenCursor,
  expressions: ExpressionParser,
  scope: BlockScope,
  isStruct: (name: string) => boolean
): DeclarationNode {
  return new DeclarationParser(tokens, expressions, scope, isStruct).declaration(first);
}

class DeclarationParser {
  constructor(
    private readonly tokens: TokenCursor,
    private readonly expressions: ExpressionParser,
    private readonly scope: BlockScope,
    private readonly isStruct: (name: string) => boolean
  ) {}

  declaration(first: Token): DeclarationNode {
    let token = first;
    const isConst = token.type === 'TK_CONST';
    if (isConst) token = this.tokens.next();
    const precision = precisionWord(token);
    if (precision) token = this.tokens.next();
    const type = this.declaredType(token, precision !== undefined);
    const declarators: Declarator[] = [];
    let typeSize: ArraySize | 'none' = 'none';
    for (;;) {
      token = this.tokens.next();
      if (declarators.length === 0) {
        if (token.type !== 'TK_IDENTIFIER' && token.type !== 'TK_BRACKET_OPEN')
          this.tokens.fail("Expected an identifier or '[' after type.");
        if (token.type === 'TK_BRACKET_OPEN') {
          typeSize = this.expressions.arrays.size(false);
          token = this.tokens.next();
        }
      }
      declarators.push(this.declarator(token, { type, precision }, isConst, typeSize));
      const end = this.tokens.next();
      if (end.type === 'TK_SEMICOLON') break;
      if (end.type !== 'TK_COMMA') this.tokens.fail("Expected a ',' or ';'.");
    }
    return { kind: 'declaration', type, isConst, declarators, position: first.position };
  }

  /** The type after `const` and a precision: a value type or a struct, never a sampler. */
  private declaredType(token: Token, hasPrecision: boolean): string {
    if (token.type === 'TK_IDENTIFIER' && this.isStruct(token.text!)) {
      if (hasPrecision) this.tokens.fail('Expected variable type after precision modifier.');
      return token.text!;
    }
    const type = keywordInstruction(token.type)?.id;
    const isValueType = type !== undefined && shapeOf(type) !== undefined;
    if (hasPrecision && !isValueType && type !== 'void')
      this.tokens.fail('Expected variable type after precision modifier.');
    if (!isValueType) this.tokens.fail('Invalid variable type (samplers are not allowed).');
    if (hasPrecision && shapeOf(type)!.scalar === 'bool')
      this.tokens.fail('The precision modifier cannot be used on boolean types.');
    return type;
  }

  /** `typeSize` is the size after the type, which every name of the declaration takes. */
  private declarator(
    token: Token,
    { type, precision }: PreciseType,
    isConst: boolean,
    typeSize: ArraySize | 'none'
  ): Declarator {
    if (token.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected an identifier.');
    const name = token.text!;
    if (this.scope.find(name, true) || builtInInstruction(name))
      this.tokens.fail(`Redefinition of '${name}'.`);
    let size = typeSize;
    if (this.tokens.peek().type === 'TK_BRACKET_OPEN') {
      this.tokens.next();
      if (size !== 'none') this.tokens.fail('Array size is already defined.');
      size = this.expressions.arrays.size(false);
    }
    const outer = this.expressions.isConstDeclaration;
    this.expressions.isConstDeclaration = isConst;
    try {
      const { value, arraySize } =
        size === 'none'
          ? this.singleValue(type, isConst)
          : this.arrayValue({ type, precision }, isConst, size);
      const values = isConst && value?.kind === 'constant' ? value.values : undefined;
      this.scope.variables.set(name, {
        type,
        arraySize: arraySize ?? 0,
        isConst,
        ...(values ? { values } : {}),
      });
      return {
        name,
        position: token.position,
        ...(arraySize !== undefined ? { arraySize } : {}),
        ...(value ? { value } : {}),
      };
    } finally {
      this.expressions.isConstDeclaration = outer;
    }
  }

  /** `= value` for one value, which a `const` must have. */
  private singleValue(type: string, isConst: boolean): { value?: Expression; arraySize?: number } {
    if (!this.tokens.accept('TK_OP_ASSIGN')) {
      if (isConst) this.tokens.fail('Expected initialization of constant.');
      return {};
    }
    const value = this.expressions.expression();
    this.expressions.requireType(type, undefined, value);
    return { value };
  }

  /** An array of unknown size takes the size of its value (`shader_language.cpp:8278`). */
  private arrayValue(
    declared: PreciseType,
    isConst: boolean,
    size: ArraySize
  ): { value?: Expression; arraySize?: number } {
    const { type } = declared;
    if (!this.tokens.accept('TK_OP_ASSIGN')) {
      if (size === undefined) this.tokens.fail('Expected array initialization.');
      if (isConst) this.tokens.fail('Expected initialization of constant.');
      return { arraySize: size };
    }
    const mark = this.tokens.mark();
    const first = this.tokens.next();
    if (first.type === 'TK_IDENTIFIER') {
      this.tokens.reset(mark);
      const value = this.expressions.expression();
      const arraySize = size ?? arraySizeOf(value);
      this.expressions.requireType(type, arraySize, value);
      return { value, arraySize };
    }
    const isCurly = first.type === 'TK_CURLY_BRACKET_OPEN';
    if (!isCurly) {
      if (size === undefined) this.tokens.fail("Expected a '{'.");
      this.constructorHead(first, declared, size);
    }
    const value = this.list(first, type, size, isCurly);
    return { value, arraySize: value.arraySize };
  }

  /** `lowp float[3](` or `float[](` after `=`, which must name the declared type and size (:8215). */
  private constructorHead(first: Token, declared: PreciseType, size: number): void {
    const precision = precisionWord(first);
    const typeToken = precision ? this.tokens.next() : first;
    if (precision && !isNonVoidType(typeToken))
      this.tokens.fail('Expected data type after precision modifier.');
    const elementType = this.expressions.arrays.elementType(typeToken);
    if (elementType === undefined) this.tokens.fail('Invalid data type for the array.');
    if (precision && shapeOf(elementType)?.scalar === 'bool')
      this.tokens.fail('The precision modifier cannot be used on boolean types.');
    if (this.tokens.next().type !== 'TK_BRACKET_OPEN') this.tokens.fail("Expected a '['.");
    const written = this.expressions.arrays.size(false) ?? size;
    if (precision !== declared.precision || elementType !== declared.type || written !== size)
      this.tokens.fail(
        `Cannot convert from '${preciseName(precision, elementType, written)}'' to '${preciseName(declared.precision, declared.type, size)}''.`
      );
    const open = this.tokens.next();
    if (open.type === 'TK_CURLY_BRACKET_OPEN') this.tokens.fail("Expected a '('.");
    if (open.type !== 'TK_PARENTHESIS_OPEN') this.tokens.fail("Expected a '('.");
  }

  /** The elements up to `)` or `}`, each of the element type. */
  private list(first: Token, type: string, size: ArraySize, isCurly: boolean): ArrayConstructNode {
    const elements: Expression[] = [];
    for (;;) {
      const element = this.expressions.expression();
      this.expressions.requireType(type, undefined, element);
      elements.push(element);
      const token = this.tokens.next();
      if (token.type === 'TK_COMMA') continue;
      if (token.type === (isCurly ? 'TK_CURLY_BRACKET_CLOSE' : 'TK_PARENTHESIS_CLOSE')) break;
      this.tokens.fail(isCurly ? "Expected a '}' or ','." : "Expected a ')' or ','.");
    }
    if (size !== undefined && elements.length !== size)
      this.tokens.fail(`Array size mismatch. Expected ${size} elements (found ${elements.length}).`);
    return { kind: 'array construct', type, arraySize: elements.length, elements, position: first.position };
  }
}

/** A declared type with the precision word before it, which an array's constructor must repeat. */
interface PreciseType {
  readonly type: string;
  readonly precision: string | undefined;
}

/** The precision word `token` is, `lowp`, or nothing. */
function precisionWord(token: Token): string | undefined {
  return token.type.startsWith('TK_PRECISION_') ? keywordInstruction(token.type)!.id : undefined;
}

const isNonVoidType = (token: Token) =>
  keywordInstruction(token.type)?.family === 'data type' && token.type !== 'TK_TYPE_VOID';

/** `lowp vec3[1]`, as Godot's message names an array type. */
const preciseName = (precision: string | undefined, type: string, size: number) =>
  `${precision ? `${precision} ` : ''}${typeName(type, size)}`;
