/** Each loop lowers to `while (true)` with its condition as `if (!c) break;`. */

import { describe, expect, it } from 'vitest';
import { loweredText, text } from './lowering.testkit.js';
import { lowerLoops } from './lowerLoops.js';

describe('lowerLoops', () => {
  it('tests a while condition at the top of each pass', () => {
    expect(loweredText(lowerLoops, 'int f(int a) { while (a < 3) a++; return a; }')).toBe(
      text(
        'int f(int a) {',
        ['while (true) {', ['if (!((a < 3))) break;', '{', ['a++;'], '}'], '}', 'return a;'],
        '}'
      )
    );
  });

  it('runs a do body once before its first test, so continue tests the condition', () => {
    expect(loweredText(lowerLoops, 'int f(int a) { do a++; while (a < 3); return a; }')).toBe(
      text(
        'int f(int a) {',
        [
          '{',
          [
            'bool lowered_first_1 = true;',
            'while (true) {',
            [
              'if (!(lowered_first_1)) if (!((a < 3))) break;',
              '(lowered_first_1 = false);',
              '{',
              ['a++;'],
              '}',
            ],
            '}',
          ],
          '}',
          'return a;',
        ],
        '}'
      )
    );
  });

  it('runs a for step on each pass after the first, so continue runs the step', () => {
    expect(loweredText(lowerLoops, 'int f(int a) { for (int i = 0; i < a; i++) a--; return a; }')).toBe(
      text(
        'int f(int a) {',
        [
          '{',
          [
            'int i = 0;',
            'bool lowered_first_1 = true;',
            'while (true) {',
            [
              'if (!(lowered_first_1)) i++;',
              '(lowered_first_1 = false);',
              'if (!((i < a))) break;',
              '{',
              ['a--;'],
              '}',
            ],
            '}',
          ],
          '}',
          'return a;',
        ],
        '}'
      )
    );
  });

  it('keeps no flag for a for without steps, and no test for one without a condition', () => {
    expect(loweredText(lowerLoops, 'int f(int a) { for (;;) { break; } return a; }')).toBe(
      text('int f(int a) {', ['{', ['while (true) {', ['{', ['break;'], '}'], '}'], '}', 'return a;'], '}')
    );
  });

  it('runs every for condition and breaks on the last', () => {
    expect(loweredText(lowerLoops, 'int f(int a) { for (; a++ > 0, a < 3;) {} return a; }')).toBe(
      text(
        'int f(int a) {',
        [
          '{',
          ['while (true) {', ['(a++ > 0);', 'if (!((a < 3))) break;', '{', ['{', '}'], '}'], '}'],
          '}',
          'return a;',
        ],
        '}'
      )
    );
  });

  it('refuses a while condition that is no bool, which Godot leaves untyped and GLSL refuses', () => {
    expect(() => loweredText(lowerLoops, 'int f(int a) { while (a) a--; return a; }')).toThrow(
      "Godot writes a loop condition of type 'int', which the GPU compiler refuses."
    );
  });
});
