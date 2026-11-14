/** The scan that finds the case groups of Godot's `_validate_operator`. */

import { describe, expect, it } from 'vitest';
import { caseGroups } from './operatorRules.mjs';

/** Far above the milliseconds a linear scan of these texts takes, far below a quadratic one. */
const TIME_LIMIT_MS = 200;

const LABEL_RUN = 20_000;

describe('caseGroups', () => {
  it('reads the labels of each group, with a comment after a label', () => {
    const body = 'case OP_ADD: // add\n\t\tcase OP_SUB: {\n} break;\ncase OP_NOT: {}';
    expect(caseGroups(body).map((group) => group.labels)).toEqual([['OP_ADD', 'OP_SUB'], ['OP_NOT']]);
  });

  it('reads a comment that ends the text', () => {
    expect(caseGroups('case OP_ADD: // add')).toEqual([]);
  });

  it.each([
    ['labels', 'case OP_0: '],
    ['labels with comments', 'case OP_0: // c\n'],
  ])('scans a long run of %s with no body in time', (_, label) => {
    const text = label.repeat(LABEL_RUN);
    const startedAt = performance.now();
    expect(caseGroups(text)).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(TIME_LIMIT_MS);
  });
});
