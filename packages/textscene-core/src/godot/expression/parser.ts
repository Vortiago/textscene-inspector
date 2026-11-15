import { UTILITY_FUNCTIONS } from '../variant/registrations.generated.js';
import type { Variant, VariantTypeName } from '../variant/value/variant.js';
import { ExpressionError, ExpressionTokenizer, type Token } from './tokenizer.js';

export type Operator =
  | 'OP_EQUAL'
  | 'OP_NOT_EQUAL'
  | 'OP_LESS'
  | 'OP_LESS_EQUAL'
  | 'OP_GREATER'
  | 'OP_GREATER_EQUAL'
  | 'OP_ADD'
  | 'OP_SUBTRACT'
  | 'OP_MULTIPLY'
  | 'OP_DIVIDE'
  | 'OP_NEGATE'
  | 'OP_POSITIVE'
  | 'OP_MODULE'
  | 'OP_POWER'
  | 'OP_SHIFT_LEFT'
  | 'OP_SHIFT_RIGHT'
  | 'OP_BIT_AND'
  | 'OP_BIT_OR'
  | 'OP_BIT_XOR'
  | 'OP_BIT_NEGATE'
  | 'OP_AND'
  | 'OP_OR'
  | 'OP_XOR'
  | 'OP_NOT'
  | 'OP_IN';

export type ExpressionNode =
  | { readonly kind: 'input'; readonly index: number }
  | { readonly kind: 'constant'; readonly value: Variant }
  | { readonly kind: 'self' }
  | {
      readonly kind: 'operator';
      readonly operator: Operator;
      readonly left: ExpressionNode;
      readonly right?: ExpressionNode;
    }
  | { readonly kind: 'index'; readonly base: ExpressionNode; readonly index: ExpressionNode }
  | { readonly kind: 'namedIndex'; readonly base: ExpressionNode; readonly name: string }
  | { readonly kind: 'array'; readonly elements: readonly ExpressionNode[] }
  | { readonly kind: 'dictionary'; readonly entries: readonly ExpressionNode[] }
  | {
      readonly kind: 'constructor';
      readonly type: VariantTypeName;
      readonly arguments: readonly ExpressionNode[];
    }
  | { readonly kind: 'builtinFunction'; readonly name: string; readonly arguments: readonly ExpressionNode[] }
  | {
      readonly kind: 'call';
      readonly base: ExpressionNode;
      readonly method: string;
      readonly arguments: readonly ExpressionNode[];
    };

type Item =
  | { readonly isOperator: true; readonly operator: Operator }
  | { readonly isOperator: false; readonly node: ExpressionNode };

const BINARY_OPERATORS: Readonly<Partial<Record<Token['type'], Operator>>> = {
  OP_IN: 'OP_IN',
  OP_EQUAL: 'OP_EQUAL',
  OP_NOT_EQUAL: 'OP_NOT_EQUAL',
  OP_LESS: 'OP_LESS',
  OP_LESS_EQUAL: 'OP_LESS_EQUAL',
  OP_GREATER: 'OP_GREATER',
  OP_GREATER_EQUAL: 'OP_GREATER_EQUAL',
  OP_AND: 'OP_AND',
  OP_OR: 'OP_OR',
  OP_NOT: 'OP_NOT',
  OP_ADD: 'OP_ADD',
  OP_SUB: 'OP_SUBTRACT',
  OP_MUL: 'OP_MULTIPLY',
  OP_DIV: 'OP_DIVIDE',
  OP_MOD: 'OP_MODULE',
  OP_POW: 'OP_POWER',
  OP_SHIFT_LEFT: 'OP_SHIFT_LEFT',
  OP_SHIFT_RIGHT: 'OP_SHIFT_RIGHT',
  OP_BIT_AND: 'OP_BIT_AND',
  OP_BIT_OR: 'OP_BIT_OR',
  OP_BIT_XOR: 'OP_BIT_XOR',
  OP_BIT_INVERT: 'OP_BIT_NEGATE',
};

// expression.cpp:1068: a lower number binds first, and the first of equal ones goes first.
const PRIORITIES: Readonly<Partial<Record<Operator, readonly [number, boolean]>>> = {
  OP_POWER: [0, false],
  OP_BIT_NEGATE: [1, true],
  OP_NEGATE: [2, true],
  OP_MULTIPLY: [3, false],
  OP_DIVIDE: [3, false],
  OP_MODULE: [3, false],
  OP_ADD: [4, false],
  OP_SUBTRACT: [4, false],
  OP_SHIFT_LEFT: [5, false],
  OP_SHIFT_RIGHT: [5, false],
  OP_BIT_AND: [6, false],
  OP_BIT_XOR: [7, false],
  OP_BIT_OR: [8, false],
  OP_LESS: [9, false],
  OP_LESS_EQUAL: [9, false],
  OP_GREATER: [9, false],
  OP_GREATER_EQUAL: [9, false],
  OP_EQUAL: [9, false],
  OP_NOT_EQUAL: [9, false],
  OP_IN: [11, false],
  OP_NOT: [12, true],
  OP_AND: [13, false],
  OP_OR: [14, false],
};

const UTILITY_ARGUMENTS = new Map(
  UTILITY_FUNCTIONS.map(([name, count, isVararg]) => [name, isVararg ? undefined : count])
);

class ParseFailure extends Error {}

/**
 * Godot's `_parse_expression` (expression.cpp:564). Godot records the first error and goes on in
 * a few places, so `error` keeps the first and a later step that checks it stops the parse.
 */
class ExpressionParser {
  private readonly tokenizer: ExpressionTokenizer;
  error: string | undefined;

  constructor(text: string) {
    this.tokenizer = new ExpressionTokenizer(text);
  }

  private setError(message: string): void {
    this.error ??= message;
  }

  private fail(message: string): never {
    this.setError(message);
    throw new ParseFailure();
  }

  // A tokenizer error sets the error and answers TK_ERROR, as `_get_token` does.
  private token(): Token {
    try {
      return this.tokenizer.token();
    } catch (error) {
      if (!(error instanceof ExpressionError)) throw error;
      this.setError(error.message);
      return { type: 'ERROR' };
    }
  }

  private checkedToken(): Token {
    const token = this.token();
    if (this.error !== undefined) throw new ParseFailure();
    return token;
  }

  private get offset(): number {
    return this.tokenizer.offset;
  }

  private set offset(offset: number) {
    this.tokenizer.offset = offset;
  }

  // The list of a call or a constructor up to `)`, read after its `(`.
  private argumentList(close: Token['type'], separatorError: string): ExpressionNode[] {
    const nodes: ExpressionNode[] = [];
    for (;;) {
      const start = this.offset;
      if (this.token().type === close) break;
      this.offset = start;
      nodes.push(this.expression());
      const after = this.offset;
      const token = this.token();
      if (token.type === close) this.offset = after;
      else if (token.type !== 'COMMA') this.setError(separatorError);
    }
    return nodes;
  }

  private dictionary(): ExpressionNode {
    const entries: ExpressionNode[] = [];
    for (;;) {
      const start = this.offset;
      if (this.token().type === 'CURLY_BRACKET_CLOSE') break;
      this.offset = start;
      entries.push(this.expression());
      if (this.token().type !== 'COLON') this.fail("Expected ':'");
      entries.push(this.expression());
      const after = this.offset;
      const token = this.token();
      if (token.type === 'CURLY_BRACKET_CLOSE') this.offset = after;
      else if (token.type !== 'COMMA') this.setError("Expected ',' or '}'");
    }
    return { kind: 'dictionary', entries };
  }

  private identifier(name: string): ExpressionNode {
    const start = this.offset;
    if (this.token().type === 'PARENTHESIS_OPEN') {
      const args = this.argumentList('PARENTHESIS_CLOSE', "Expected ',' or ')'");
      return { kind: 'call', base: { kind: 'self' }, method: name, arguments: args };
    }
    this.offset = start;
    return { kind: 'namedIndex', base: { kind: 'self' }, name };
  }

  private constructorCall(type: VariantTypeName): ExpressionNode {
    if (this.token().type !== 'PARENTHESIS_OPEN') this.fail("Expected '('");
    return {
      kind: 'constructor',
      type,
      arguments: this.argumentList('PARENTHESIS_CLOSE', "Expected ',' or ')'"),
    };
  }

  private builtinFunction(name: string): ExpressionNode {
    if (this.token().type !== 'PARENTHESIS_OPEN') this.fail("Expected '('");
    const args = this.argumentList('PARENTHESIS_CLOSE', "Expected ',' or ')'");
    const expected = UTILITY_ARGUMENTS.get(name);
    if (expected !== undefined && expected !== args.length)
      this.setError(`Builtin func '${name}' expects ${expected} argument(s).`);
    return { kind: 'builtinFunction', name, arguments: args };
  }

  // An operand, or the unary operator that comes before one.
  private operand(token: Token): ExpressionNode | Operator {
    switch (token.type) {
      case 'CURLY_BRACKET_OPEN':
        return this.dictionary();
      case 'BRACKET_OPEN':
        return { kind: 'array', elements: this.argumentList('BRACKET_CLOSE', "Expected ',' or ']'") };
      case 'PARENTHESIS_OPEN': {
        const inner = this.expression();
        if (this.error !== undefined) throw new ParseFailure();
        if (this.token().type !== 'PARENTHESIS_CLOSE') this.fail("Expected ')'");
        return inner;
      }
      case 'IDENTIFIER':
        return this.identifier(token.value);
      case 'INPUT':
        return { kind: 'input', index: token.value };
      case 'SELF':
        return { kind: 'self' };
      case 'CONSTANT':
        return { kind: 'constant', value: token.value };
      case 'BASIC_TYPE':
        return this.constructorCall(token.value);
      case 'BUILTIN_FUNC':
        return this.builtinFunction(token.value);
      case 'OP_SUB':
        return 'OP_NEGATE';
      case 'OP_NOT':
        return 'OP_NOT';
      default:
        return this.fail('Expected expression.');
    }
  }

  // expression.cpp:852: `[index]`, `.name` and `.method(...)` after an operand.
  private postfix(base: ExpressionNode): ExpressionNode {
    let node = base;
    for (;;) {
      const start = this.offset;
      const token = this.checkedToken();
      if (token.type === 'BRACKET_OPEN') {
        const index = this.expression();
        if (this.token().type !== 'BRACKET_CLOSE') this.fail("Expected ']' at end of index.");
        node = { kind: 'index', base: node, index };
      } else if (token.type === 'PERIOD') {
        const name = this.token();
        if (name.type !== 'IDENTIFIER' && name.type !== 'BUILTIN_FUNC')
          this.fail("Expected identifier after '.'");
        const afterName = this.offset;
        if (this.token().type === 'PARENTHESIS_OPEN') {
          const args = this.argumentList('PARENTHESIS_CLOSE', "Expected ',' or ')'");
          node = { kind: 'call', base: node, method: name.value, arguments: args };
        } else {
          this.offset = afterName;
          node = { kind: 'namedIndex', base: node, name: name.value };
        }
      } else {
        this.offset = start;
        return node;
      }
    }
  }

  expression(): ExpressionNode {
    const items: Item[] = [];
    for (;;) {
      const operand = this.operand(this.checkedToken());
      if (typeof operand === 'string') {
        items.push({ isOperator: true, operator: operand });
        continue;
      }
      items.push({ isOperator: false, node: this.postfix(operand) });
      const start = this.offset;
      const operator = BINARY_OPERATORS[this.checkedToken().type];
      if (operator === undefined) {
        this.offset = start;
        break;
      }
      items.push({ isOperator: true, operator });
    }
    return this.reduce(items);
  }

  // expression.cpp:1062: the operator of the lowest priority number joins its operands, until one node is left.
  private reduce(items: Item[]): ExpressionNode {
    while (items.length > 1) {
      let next = -1;
      let lowest = Infinity;
      let isUnary = false;
      items.forEach((item, index) => {
        if (!item.isOperator) return;
        const [priority, unary] = PRIORITIES[item.operator]!;
        if (priority < lowest) {
          next = index;
          lowest = priority;
          isUnary = unary;
        }
      });
      if (next === -1) this.fail('Yet another parser bug....');
      if (isUnary) this.reduceUnary(items, next);
      else this.reduceBinary(items, next);
    }
    const [only] = items;
    return (only as Extract<Item, { isOperator: false }>).node;
  }

  private reduceUnary(items: Item[], first: number): void {
    let operandIndex = first;
    while (items[operandIndex]!.isOperator) {
      operandIndex += 1;
      if (operandIndex === items.length) this.fail('Unexpected end of expression...');
    }
    for (let index = operandIndex - 1; index >= first; index -= 1) {
      const operator = (items[index] as Extract<Item, { isOperator: true }>).operator;
      const operand = (items[index + 1] as Extract<Item, { isOperator: false }>).node;
      items.splice(index, 2, { isOperator: false, node: { kind: 'operator', operator, left: operand } });
    }
  }

  private reduceBinary(items: Item[], index: number): void {
    if (index < 1 || index >= items.length - 1 || items[index - 1]!.isOperator) this.fail('Parser bug...');
    if (items[index + 1]!.isOperator) this.fail('Unexpected two consecutive operators.');
    const operator = (items[index] as Extract<Item, { isOperator: true }>).operator;
    const left = (items[index - 1] as Extract<Item, { isOperator: false }>).node;
    const right = (items[index + 1] as Extract<Item, { isOperator: false }>).node;
    items.splice(index - 1, 3, { isOperator: false, node: { kind: 'operator', operator, left, right } });
  }
}

export type ParsedExpression = { readonly root: ExpressionNode } | { readonly error: string };

/** `Expression::parse` (expression.cpp:1465) with no input names. */
export function parseExpression(text: string): ParsedExpression {
  const parser = new ExpressionParser(text);
  try {
    const root = parser.expression();
    return parser.error === undefined ? { root } : { error: parser.error };
  } catch (error) {
    if (!(error instanceof ParseFailure)) throw error;
    return { error: parser.error! };
  }
}
