/** Each write an expression orders becomes the order of statements. */

import { describe, expect, it } from 'vitest';
import { loweredText, text } from './lowering.testkit.js';
import { lowerSideEffects } from './lowerSideEffects.js';

const lowered = (source: string) => loweredText(lowerSideEffects, source);

describe('lowerSideEffects', () => {
  it('keeps a value read before a part that writes it', () => {
    expect(lowered('float f(float a) { return a + (a = 3.0); }')).toBe(
      text('float f(float a) {', ['float lowered_value_1 = a;', 'return (lowered_value_1 + (a = 3.0));'], '}')
    );
  });

  it('runs one side of a select that writes, in an if', () => {
    expect(lowered('int f(int a, bool c) { return c ? a++ : a--; }')).toBe(
      text(
        'int f(int a, bool c) {',
        [
          'int lowered_value_1;',
          'if (c) (lowered_value_1 = a++);',
          'else (lowered_value_1 = a--);',
          'return lowered_value_1;',
        ],
        '}'
      )
    );
  });

  it('runs the second side of && only when the first is true', () => {
    expect(lowered('bool f(int a) { return a > 0 && a++ > 1; }')).toBe(
      text(
        'bool f(int a) {',
        [
          'bool lowered_value_1 = (a > 0);',
          'if (lowered_value_1) (lowered_value_1 = (a++ > 1));',
          'return lowered_value_1;',
        ],
        '}'
      )
    );
  });

  it('runs the second side of || only when the first is false', () => {
    expect(lowered('bool f(int a) { return a > 0 || a++ > 1; }')).toBe(
      text(
        'bool f(int a) {',
        [
          'bool lowered_value_1 = (a > 0);',
          'if (!(lowered_value_1)) (lowered_value_1 = (a++ > 1));',
          'return lowered_value_1;',
        ],
        '}'
      )
    );
  });

  it('runs an index that writes once, before a compound assignment', () => {
    expect(
      lowered('float f(int i) { float a[3] = float[3](1.0, 2.0, 3.0); a[i++] += 1.0; return a[0]; }')
    ).toBe(
      text(
        'float f(int i) {',
        [
          'float a[3] = {1.0, 2.0, 3.0};',
          'int lowered_value_1 = i++;',
          '(a[lowered_value_1] += 1.0);',
          'return a[0];',
        ],
        '}'
      )
    );
  });

  it('keeps an index that reads before a value that writes, as GLSL reads the place first', () => {
    expect(lowered('int f(int i) { int a[3] = int[3](0, 0, 0); a[i] = 10 + i++; return a[0]; }')).toBe(
      text(
        'int f(int i) {',
        [
          'int a[3] = {0, 0, 0};',
          'int lowered_value_1 = i;',
          '(a[lowered_value_1] = (10 + i++));',
          'return a[0];',
        ],
        '}'
      )
    );
  });

  it('splits a declaration, so a value that writes runs after the names before it', () => {
    expect(lowered('int f(int a) { int b = 1, c = b + a++; return c; }')).toBe(
      text(
        'int f(int a) {',
        ['int b = 1;', 'int lowered_value_1 = b;', 'int c = (lowered_value_1 + a++);', 'return c;'],
        '}'
      )
    );
  });

  it('orders the writes of a condition before its if', () => {
    expect(lowered('int f(int a, bool c) { int b = 0; if (c && a++ > 0) { b = 1; } return b; }')).toBe(
      text(
        'int f(int a, bool c) {',
        [
          'int b = 0;',
          'bool lowered_value_1 = c;',
          'if (lowered_value_1) (lowered_value_1 = (a++ > 0));',
          'if (lowered_value_1) {',
          ['(b = 1);'],
          '}',
          'return b;',
        ],
        '}'
      )
    );
  });

  it('passes an inout place before an argument that writes it, as glslang reads it after the arguments', () => {
    expect(
      lowered('void s(inout float x, float y) { x += y; } float f(float b) { s(b, b = 2.0); return b; }')
    ).toBe(text('float f(float b) {', ['s(b, (b = 2.0));', 'return b;'], '}'));
  });

  it('keeps the indices of each place a call writes, when it writes more than one', () => {
    expect(
      lowered(
        'void s(out int i, out float x) { i = 1; x = 2.0; } float f(float a) { float v[2]; int k = 0; s(k, v[k]); return v[0]; }'
      )
    ).toBe(
      text(
        'float f(float a) {',
        [
          'float v[2];',
          'int k = 0;',
          'int lowered_value_1 = k;',
          's(k, v[lowered_value_1]);',
          'return v[0];',
        ],
        '}'
      )
    );
  });

  it('leaves a statement whose write nothing reads around', () => {
    expect(lowered('int f(int a) { a++; return a; }')).toBe(
      text('int f(int a) {', ['a++;', 'return a;'], '}')
    );
  });
});
