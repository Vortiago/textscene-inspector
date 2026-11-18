import { describe, expect, it } from 'vitest';
import { variant } from '../variant/value/variant.js';
import { parseExpression } from './parser.js';

const constant = (value: bigint) => ({ kind: 'constant', value: variant('INT', value) });

describe('parseExpression', () => {
  it('builds the tree of 1 + 2 * 3 with * below +', () => {
    expect(parseExpression('1 + 2 * 3')).toMatchObject({
      root: {
        kind: 'operator',
        operator: 'OP_ADD',
        left: constant(1n),
        right: { kind: 'operator', operator: 'OP_MULTIPLY', left: constant(2n), right: constant(3n) },
      },
    });
  });

  it('gives the parse error of a missing operand', () => {
    expect(parseExpression('1 +')).toEqual({ error: 'Expected expression.' });
  });

  it('gives the tokenizer error of a lone =', () => {
    expect(parseExpression('1 = 2')).toEqual({ error: "Expected '='" });
  });
});
