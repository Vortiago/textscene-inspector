/** A function lowers to one exit, its last statement. */

import { describe, expect, it } from 'vitest';
import { loweredText, text } from './lowering.testkit.js';
import { lowerLoops } from './lowerLoops.js';
import { lowerReturns } from './lowerReturns.js';

const afterLoops: Parameters<typeof loweredText>[0] = (definition, names) =>
  lowerReturns(lowerLoops(definition, names), names);

describe('lowerReturns', () => {
  it('leaves a function whose one return is its last statement', () => {
    expect(loweredText(lowerReturns, 'int f(int a) { a++; return a; }')).toBe(
      text('int f(int a) {', ['a++;', 'return a;'], '}')
    );
  });

  it('runs the statements after a return in a branch only when it did not return', () => {
    expect(loweredText(lowerReturns, 'int f(int a) { if (a > 1) return 2; return a; }')).toBe(
      text(
        'int f(int a) {',
        [
          'int lowered_result_1;',
          'bool lowered_returned_1 = false;',
          'if ((a > 1)) {',
          ['(lowered_result_1 = 2);', '(lowered_returned_1 = true);'],
          '}',
          'if (!(lowered_returned_1)) {',
          ['(lowered_result_1 = a);', '(lowered_returned_1 = true);'],
          '}',
          'return lowered_result_1;',
        ],
        '}'
      )
    );
  });

  it('leaves every loop around a return, an inner loop and then the outer one', () => {
    const lowered = loweredText(
      afterLoops,
      'int f(int a) { while (true) { while (true) { if (a > 1) return a; a++; } } return 0; }'
    );
    expect(lowered).toBe(
      text(
        'int f(int a) {',
        [
          'int lowered_result_1;',
          'bool lowered_returned_1 = false;',
          'while (true) {',
          [
            'if (!(true)) break;',
            '{',
            [
              '{',
              [
                'while (true) {',
                [
                  'if (!(true)) break;',
                  '{',
                  [
                    '{',
                    [
                      'if ((a > 1)) {',
                      ['(lowered_result_1 = a);', '(lowered_returned_1 = true);', 'break;'],
                      '}',
                      'a++;',
                    ],
                    '}',
                  ],
                  '}',
                ],
                '}',
                'if (lowered_returned_1) break;',
              ],
              '}',
            ],
            '}',
          ],
          '}',
          'if (!(lowered_returned_1)) {',
          ['(lowered_result_1 = 0);', '(lowered_returned_1 = true);'],
          '}',
          'return lowered_result_1;',
        ],
        '}'
      )
    );
  });

  it('sets only the flag for a return of a void function, and ends with no return', () => {
    expect(loweredText(lowerReturns, 'void f(int a) { if (a > 1) return; a++; }')).toBe(
      text(
        'void f(int a) {',
        [
          'bool lowered_returned_1 = false;',
          'if ((a > 1)) (lowered_returned_1 = true);',
          'if (!(lowered_returned_1)) a++;',
        ],
        '}'
      )
    );
  });
});
