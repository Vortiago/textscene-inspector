/**
 * Godot's array sizes and array constructors (`_parse_array_size`, `shader_language.cpp:5682`, and
 * the two `_parse_array_constructor`s, `shader_language.cpp:5751` and `:5840`), with Godot's
 * messages.
 */

import { keywordInstruction } from './instructions.js';
import type { ExpressionParser, ExpressionScope } from './parseExpression.js';
import { arraySizeOf, typeName } from './parseExpression.js';
import type { ArrayConstructNode, Expression } from './shaderTree.js';
import type { TokenCursor } from './tokenCursor.js';
import type { Token } from './tokenizer.js';
import { shapeOf } from './types.js';

/** An array size in `[]`: its element count, or nothing for `[]`, whose size the value gives. */
export type ArraySize = number | undefined;

export class ArrayParser {
  constructor(
    private readonly tokens: TokenCursor,
    private readonly expressions: ExpressionParser,
    private readonly scope: ExpressionScope
  ) {}

  /** The size after `[` up to `]`: a positive integer constant, or nothing for `[]` where allowed. */
  size(isUnknownForbidden: boolean): ArraySize {
    const mark = this.tokens.mark();
    if (this.tokens.next().type === 'TK_BRACKET_CLOSE') {
      if (isUnknownForbidden) this.tokens.fail('Unknown array size is forbidden in that context.');
      return undefined;
    }
    this.tokens.reset(mark);
    const count = this.constantInteger(this.expressions.expression());
    if (!(count > 0)) this.tokens.fail('Expected a positive integer constant.');
    if (this.tokens.next().type !== 'TK_BRACKET_CLOSE') this.tokens.fail("Expected a ']'.");
    return count;
  }

  /** The integer an `int` or `uint` constant or `const` local holds, or 0 for any other size. */
  private constantInteger(size: Expression): number {
    if (size.type !== 'int' && size.type !== 'uint') return 0;
    const values = size.kind === 'constant' ? size.values : this.constantValues(size);
    if (values === undefined) return 0;
    return size.type === 'int' ? (values[0] as number) | 0 : (values[0] as number);
  }

  /** The lanes of a `const` local a size reads, or nothing. */
  private constantValues(size: Expression): readonly unknown[] | undefined {
    if (size.kind !== 'variable') return undefined;
    const found = this.scope.identifier(size.name);
    return found?.kind === 'local' ? found.values : undefined;
  }

  /** `{a, b}` or `float[2](a, b)` where any array may stand, typed by itself. */
  constructed(): ArrayConstructNode {
    const first = this.tokens.next();
    if (first.type === 'TK_CURLY_BRACKET_OPEN') return this.listed(first, undefined, undefined);
    const type = this.elementType(first) ?? this.tokens.fail('Invalid data type for the array.');
    if (this.tokens.next().type !== 'TK_BRACKET_OPEN') this.tokens.fail("Expected a '['.");
    const size = this.size(false);
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN') this.tokens.fail('Expected array initialization.');
    return this.listed(first, type, size);
  }

  /**
   * The value of an array of `type` and `arraySize` elements: `{...}`, `float[2](...)`, `float[](...)`,
   * or any expression of that array type.
   */
  typedConstructed(type: string, arraySize: number): Expression {
    const mark = this.tokens.mark();
    const first = this.tokens.next();
    if (first.type === 'TK_CURLY_BRACKET_OPEN') return this.typedList(first, type, arraySize, true);
    const elementType = this.elementType(first);
    if (elementType === undefined) {
      this.tokens.reset(mark);
      const value = this.expressions.expression();
      this.expressions.requireType(type, arraySize, value);
      return value;
    }
    if (this.tokens.next().type !== 'TK_BRACKET_OPEN') this.tokens.fail("Expected a '['.");
    const size = this.size(false) ?? arraySize;
    if (elementType !== type || size !== arraySize) {
      this.tokens.fail(
        `Cannot convert from '${typeName(elementType, size)}'' to '${typeName(type, arraySize)}''.`
      );
    }
    if (this.tokens.next().type !== 'TK_PARENTHESIS_OPEN') this.tokens.fail('Expected array initialization.');
    return this.typedList(first, type, arraySize, false);
  }

  /** The element type a token names: a value type or a struct, or nothing. */
  elementType(token: Token): string | undefined {
    if (token.type === 'TK_IDENTIFIER' && this.scope.struct(token.text!)) return token.text!;
    const type = keywordInstruction(token.type)?.id;
    return type !== undefined && shapeOf(type) !== undefined ? type : undefined;
  }

  /**
   * The elements up to `)`, or `}` when `curly`, the first typing the rest when the type is not
   * given. A given size must match the count.
   */
  private listed(first: Token, givenType: string | undefined, size: ArraySize): ArrayConstructNode {
    const isCurly = givenType === undefined;
    const elements: Expression[] = [];
    let type = givenType;
    for (;;) {
      const element = this.expressions.expression();
      if (type === undefined) type = element.type;
      else this.expressions.requireType(type, undefined, element);
      elements.push(element);
      if (this.listEnds(isCurly)) break;
    }
    if (!isCurly && size !== undefined && elements.length !== size) {
      this.tokens.fail(`Array size mismatch. Expected ${size} elements (found ${elements.length}).`);
    }
    return {
      kind: 'array construct',
      type: type!,
      arraySize: elements.length,
      elements,
      position: first.position,
    };
  }

  private typedList(first: Token, type: string, arraySize: number, isCurly: boolean): ArrayConstructNode {
    const elements: Expression[] = [];
    for (;;) {
      const element = this.expressions.expression();
      if (element.type !== type || arraySizeOf(element) !== 0)
        this.expressions.requireType(type, undefined, element);
      elements.push(element);
      if (this.listEnds(isCurly)) break;
    }
    if (elements.length !== arraySize) {
      this.tokens.fail(`Array size mismatch. Expected ${arraySize} elements (found ${elements.length}).`);
    }
    return { kind: 'array construct', type, arraySize, elements, position: first.position };
  }

  /** Whether the list ends after an element: `,` continues it, and `)` or `}` ends it. */
  private listEnds(isCurly: boolean): boolean {
    const token = this.tokens.next();
    if (token.type === 'TK_COMMA') return false;
    if (token.type === (isCurly ? 'TK_CURLY_BRACKET_CLOSE' : 'TK_PARENTHESIS_CLOSE')) return true;
    this.tokens.fail(isCurly ? "Expected a '}' or ','." : "Expected a ')' or ','.");
  }
}
