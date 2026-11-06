/** How Montserrat SemiBold's mark subset draws characters it lacks, against the offsets HarfBuzz shapes (`markPositioning.test.ts`). */
import { describe, expect, it } from 'vitest';
import { openFontContainer } from './fontContainer';
import { sfntDecomposition, usesFallbackMarks } from './sfntDecomposition';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { FALLBACK_MARK_TABLE_TAGS, openSfnt } from './sfntTables';

/** The font's em in px: a design unit is then a whole pixel, so the GPOS units read back unchanged. */
const EM_PX = 1000;

const decompositionOf = (font: string) => {
  const decomposition = sfntDecomposition(openSfnt(fixtureFontBytes(font))!)!;
  return (ch: string) => decomposition(ch, EM_PX);
};
const decomposition = () => decompositionOf('montserrat-semibold-marks-subset.ttf');

describe('sfntDecomposition', () => {
  it('draws a character the font lacks as its base and the mark at the GPOS offset', () => {
    expect(decomposition()('Ä')).toEqual({
      base: 'A',
      marks: [{ char: '\u0308', xPx: 674, yPx: 166 }],
    });
  });

  it('keeps the composite the font would have as the base, and stacks the second mark', () => {
    expect(decomposition()('Ȫ')?.marks).toEqual([
      { char: '\u0308', xPx: 721, yPx: 166 },
      { char: '\u0304', xPx: 721, yPx: 322 },
    ]);
  });

  it('answers null for a character the font has', () => {
    expect(decomposition()('A')).toBeNull();
  });

  it('answers null for a character whose mark the font lacks', () => {
    expect(decomposition()('Ç')).toBeNull();
  });

  it('places the marks by the fallback where the font has no GPOS script', () => {
    expect(decompositionOf('montserrat-semibold-marks-nogpos-subset.ttf')('Ǟ')).toEqual({
      base: 'A',
      marks: [
        { char: '\u0308', xPx: 674.5, yPx: 144.5 },
        { char: '\u0304', xPx: 674.5, yPx: 308 },
      ],
    });
  });

  it('places the marks of a WOFF2 by the fallback from the tables the loader reopens it with', async () => {
    const bytes = fixtureFontBytes('montserrat-semibold-marks-nogpos-subset.woff2');
    const sfnt = (await openFontContainer(bytes))!;
    const outlines = (await openFontContainer(bytes, FALLBACK_MARK_TABLE_TAGS))!;

    expect(usesFallbackMarks(sfnt)).toBe(true);
    expect(sfntDecomposition(sfnt, outlines)!('Ä', EM_PX)?.marks).toEqual([
      { char: '\u0308', xPx: 674.5, yPx: 144.5 },
    ]);
  });
});
