/** How Montserrat SemiBold's mark subset draws characters it lacks, against the offsets HarfBuzz shapes (`markPositioning.test.ts`). */
import { describe, expect, it } from 'vitest';
import { sfntDecomposition } from './sfntDecomposition';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { openSfnt } from './sfntTables';

const decomposition = () =>
  sfntDecomposition(openSfnt(fixtureFontBytes('montserrat-semibold-marks-subset.ttf'))!)!;

describe('sfntDecomposition', () => {
  it('draws a character the font lacks as its base and the mark at the GPOS offset', () => {
    expect(decomposition()('Ä')).toEqual({
      base: 'A',
      marks: [{ char: '̈', xUnits: 674, yUnits: 166 }],
    });
  });

  it('keeps the composite the font would have as the base, and stacks the second mark', () => {
    expect(decomposition()('Ȫ')?.marks).toEqual([
      { char: '̈', xUnits: 721, yUnits: 166 },
      { char: '̄', xUnits: 721, yUnits: 322 },
    ]);
  });

  it('answers null for a character the font has', () => {
    expect(decomposition()('A')).toBeNull();
  });

  it('answers null for a character whose mark the font lacks', () => {
    expect(decomposition()('Ç')).toBeNull();
  });
});
