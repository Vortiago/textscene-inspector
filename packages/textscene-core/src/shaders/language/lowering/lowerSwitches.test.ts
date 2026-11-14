/** Each `switch` lowers to a chain of `if`s in a `while (true)` that runs once. */

import { describe, expect, it } from 'vitest';
import { loweredText, text } from './lowering.testkit.js';
import { lowerSwitches } from './lowerSwitches.js';

const SOURCE =
  'int f(int a) { switch (a) { case 1: a = 2; case 2: a = 3; break; default: a = 4; break; } return a; }';

describe('lowerSwitches', () => {
  it('falls from a case into the next, and runs default when no case matches', () => {
    expect(loweredText(lowerSwitches, SOURCE)).toBe(
      text(
        'int f(int a) {',
        [
          '{',
          [
            'int lowered_switch_value_1 = a;',
            'bool lowered_falls_1 = false;',
            'bool lowered_matches_1 = ((lowered_switch_value_1 == 1) || (lowered_switch_value_1 == 2));',
            'while (true) {',
            [
              'if ((lowered_falls_1 || (lowered_switch_value_1 == 1))) {',
              ['(lowered_falls_1 = true);', '{', ['(a = 2);'], '}'],
              '}',
              'if ((lowered_falls_1 || (lowered_switch_value_1 == 2))) {',
              ['(lowered_falls_1 = true);', '{', ['(a = 3);', 'break;'], '}'],
              '}',
              'if ((lowered_falls_1 || !(lowered_matches_1))) {',
              ['(lowered_falls_1 = true);', '{', ['(a = 4);', 'break;'], '}'],
              '}',
              'break;',
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

  it('keeps no match flag for a switch without default', () => {
    const lowered = loweredText(
      lowerSwitches,
      'int f(int a) { switch (a) { case 1: a = 2; break; } return a; }'
    );
    expect(lowered).not.toContain('lowered_matches');
  });

  it('runs a default alone when nothing can match', () => {
    const lowered = loweredText(
      lowerSwitches,
      'int f(int a) { switch (a) { default: a = 2; break; } return a; }'
    );
    expect(lowered).toContain('bool lowered_matches_1 = false;');
  });
});
