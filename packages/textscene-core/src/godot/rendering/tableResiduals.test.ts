import { describe, expect, it } from 'vitest';
import { fromResiduals, toResiduals } from './tableResiduals';

/**
 * Two channels over a 3×2 table, worked by hand. Channel a holds 10 12 15 over 11 11 13, channel b
 * holds 5 5 5 over 6 8 9, interleaved per texel.
 */
const SHAPE = { width: 3, channels: 2 };
const WORDS = [10, 5, 12, 5, 15, 5, 11, 6, 11, 8, 13, 9];
const RESIDUALS = [10, 2, 1, 1, 0, 2, 5, 0, 0, 1, 2, -1];

describe('toResiduals', () => {
  it('predicts each word from the two before it in its row, and a row start from the one above', () => {
    expect(toResiduals(WORDS, SHAPE)).toEqual(RESIDUALS);
  });
});

describe('fromResiduals', () => {
  it('gives back the interleaved words', () => {
    expect(fromResiduals(RESIDUALS, SHAPE)).toEqual(WORDS);
  });

  it('keeps every 32-bit word exact (edge case)', () => {
    const words = [0, 0xffffffff, 0x80000000, 1, 0xffffffff, 0];
    expect(fromResiduals(toResiduals(words, { width: 3, channels: 1 }), { width: 3, channels: 1 })).toEqual(
      words
    );
  });
});
