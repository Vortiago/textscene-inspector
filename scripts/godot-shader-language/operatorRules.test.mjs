/** The pattern that finds the case groups of Godot's `_validate_operator`. */

import { describe, expect, it } from 'vitest';
import { caseGroupPattern } from './operatorRules.mjs';

/** Far above the microseconds a linear match of these texts takes. */
const TIME_LIMIT_MS = 100;

describe('caseGroupPattern', () => {
  it('finds the labels of a group, with a comment after a label', () => {
    const [match] = 'case OP_ADD: // add\n\t\tcase OP_SUB: {'.matchAll(caseGroupPattern());
    expect([...match[1].matchAll(/case (OP_\w+):/g)].map((label) => label[1])).toEqual(['OP_ADD', 'OP_SUB']);
  });

  it.each([
    ['labels', 'case OP_0:' + ' case OP_0:'.repeat(26)],
    ['labels with comments', 'case OP_0://' + 'case OP_0://'.repeat(26)],
  ])('fails a long run of %s with no body in linear time', (_, text) => {
    const startedAt = performance.now();
    expect(caseGroupPattern().exec(text)).toBeNull();
    expect(performance.now() - startedAt).toBeLessThan(TIME_LIMIT_MS);
  });
});
