/**
 * The value of an `#if` condition, as glslang's `TPpContext::eval` gives it (`Pp.cpp:417`):
 * `defined` first, then the macros, then 32-bit integer arithmetic in which a name no macro
 * defines reads as 0.
 */

import { ShadingLanguageError, type SourcePosition } from '../language/shadingLanguageError.js';
import type { PpToken } from './ppScanner.js';

/** What a condition needs of the preprocessor: the macros, and the expansion of a token list. */
export interface ConditionMacros {
  readonly macros: ReadonlyMap<string, unknown>;
  expandedArgument(tokens: readonly PpToken[]): PpToken[];
}

/** The binary operators by glslang's precedence, lowest first (`Pp.cpp:349`). */
const BINARY: Readonly<Record<string, readonly [number, (a: number, b: number) => number]>> = {
  '||': [1, (a, b) => Number(a !== 0 || b !== 0)],
  '&&': [2, (a, b) => Number(a !== 0 && b !== 0)],
  '|': [3, (a, b) => a | b],
  '^': [4, (a, b) => a ^ b],
  '&': [5, (a, b) => a & b],
  '==': [6, (a, b) => Number(a === b)],
  '!=': [6, (a, b) => Number(a !== b)],
  '>': [7, (a, b) => Number(a > b)],
  '>=': [7, (a, b) => Number(a >= b)],
  '<': [7, (a, b) => Number(a < b)],
  '<=': [7, (a, b) => Number(a <= b)],
  '<<': [8, (a, b) => a << b],
  '>>': [8, (a, b) => a >> b],
  '+': [9, (a, b) => (a + b) | 0],
  '-': [9, (a, b) => (a - b) | 0],
  '*': [10, (a, b) => Math.imul(a, b)],
  '/': [10, (a, b) => (a === -2147483648 && b === -1 ? 0 : (a / b) | 0)],
  '%': [10, (a, b) => (a === -2147483648 && b === -1 ? 0 : (a % b) | 0)],
};

const UNARY: Readonly<Record<string, (a: number) => number>> = {
  '+': (a) => a,
  '-': (a) => -a | 0,
  '~': (a) => ~a,
  '!': (a) => Number(a === 0),
};

/** The value of the condition `tokens` of the `#if` at `position`. */
export function evaluateCondition(
  tokens: readonly PpToken[],
  preprocessor: ConditionMacros,
  position: SourcePosition
): number {
  const fail = (message: string): never => {
    throw new ShadingLanguageError(`'#if' : ${message}`, position);
  };
  const resolved = preprocessor.expandedArgument(definedResolved(tokens, preprocessor, fail));
  const reader = new ConditionReader(resolved, fail);
  const value = reader.expression(0);
  if (!reader.isAtEnd()) fail('unexpected tokens following directive');
  return value;
}

/** `tokens` with each `defined X` and `defined(X)` as `1` or `0`. */
function definedResolved(
  tokens: readonly PpToken[],
  preprocessor: ConditionMacros,
  fail: (message: string) => never
): PpToken[] {
  const out: PpToken[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token.text !== 'defined' || token.kind !== 'identifier') {
      out.push(token);
      continue;
    }
    const hasParenthesis = tokens[index + 1]?.text === '(';
    const name = tokens[index + (hasParenthesis ? 2 : 1)];
    if (name?.kind !== 'identifier') fail('incorrect directive, expected identifier');
    index += hasParenthesis ? 3 : 1;
    if (hasParenthesis && tokens[index]?.text !== ')') fail("expected ')'");
    out.push({ ...token, kind: 'number', text: preprocessor.macros.has(name.text) ? '1' : '0' });
  }
  return out;
}

class ConditionReader {
  private index = 0;
  /** Above zero while the reader reads the side of `&&` or `||` that glslang skips. */
  private skipDepth = 0;

  constructor(
    private readonly tokens: readonly PpToken[],
    private readonly fail: (message: string) => never
  ) {}

  isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }

  /** Precedence climbing: operators above `precedence` bind to the operand read first. */
  expression(precedence: number): number {
    let value = this.operand();
    for (;;) {
      const op = this.tokens[this.index]?.text ?? '';
      const operator = BINARY[op];
      if (!operator || operator[0] <= precedence) return value;
      this.index += 1;
      const skips = (op === '&&' && value === 0) || (op === '||' && value !== 0);
      if (skips) this.skipDepth += 1;
      const right = this.expression(operator[0]);
      if (skips) this.skipDepth -= 1;
      // glslang's `shortCircuit` (`Pp.cpp`): a skipped side still parses, but divides by 0 freely.
      if ((op === '/' || op === '%') && right === 0 && this.skipDepth === 0) this.fail('division by 0');
      value = operator[1](value, right);
    }
  }

  private operand(): number {
    const token = this.tokens[this.index++];
    if (!token) return this.fail('bad expression');
    if (token.text === '(') {
      const value = this.expression(0);
      if (this.tokens[this.index++]?.text !== ')') this.fail("expected ')'");
      return value;
    }
    const unary = UNARY[token.text];
    if (unary && token.kind === 'punctuator') return unary(this.operand());
    if (token.kind === 'identifier') return 0;
    if (token.kind === 'number') return integerValue(token.text, this.fail);
    return this.fail('bad expression');
  }
}

/** A decimal, octal or hexadecimal integer with an optional `u`, as a 32-bit signed value. */
function integerValue(text: string, fail: (message: string) => never): number {
  const digits = text.replace(/[uU]$/, '');
  if (/^0[xX][0-9a-fA-F]+$/.test(digits)) return Number.parseInt(digits, 16) | 0;
  if (/^0[0-7]*$/.test(digits)) return Number.parseInt(digits, 8) | 0;
  if (/^[1-9]\d*$/.test(digits)) return Number(digits) | 0;
  return fail('bad expression');
}
