/** How Montserrat SemiBold's mark subset draws characters it lacks, against the offsets HarfBuzz shapes (`markPositioning.test.ts`). */
import { describe, expect, it, vi } from 'vitest';
import { lazyFontContainer, openFontContainer } from './fontContainer';
import { sfntDecomposition } from './sfntDecomposition';
import { fixtureFontBytes, fixtureSfnt } from './sfntOutlines.testkit';
import { FALLBACK_MARK_TABLE_TAGS } from './sfntTables';

/** The font's em in px: a design unit is then a whole pixel, so the GPOS units read back unchanged. */
const EM_PX = 1000;

const decompositionOf = (font: string) => {
  const decomposition = sfntDecomposition(fixtureSfnt(font))!;
  return (ch: string) => decomposition(ch, EM_PX);
};
const decomposition = () => decompositionOf('montserrat-semibold-marks-subset.ttf');

describe('sfntDecomposition', () => {
  it('draws a character the font lacks as its base and the mark at the GPOS offset', () => {
    expect(decomposition()('Ä')).toEqual({
      base: 'A',
      marks: [{ char: '\u0308', x: 674, y: 166 }],
    });
  });

  it('keeps the composite the font would have as the base, and stacks the second mark', () => {
    expect(decomposition()('Ȫ')?.marks).toEqual([
      { char: '\u0308', x: 721, y: 166 },
      { char: '\u0304', x: 721, y: 322 },
    ]);
  });

  it('keeps the decompositions of the sizes read most recently, so a size animation cannot grow the cache', () => {
    const decompose = sfntDecomposition(fixtureSfnt('montserrat-semibold-marks-subset.ttf'))!;
    const first = decompose('Ä', 10);
    for (let size = 11; size <= 18; size++) decompose('Ä', size);
    expect(decompose('Ä', 18)).toBe(decompose('Ä', 18));
    expect(decompose('Ä', 10)).not.toBe(first);
    expect(decompose('Ä', 10)).toEqual(first);
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
        { char: '\u0308', x: 674.5, y: 144.5 },
        { char: '\u0304', x: 674.5, y: 308 },
      ],
    });
  });

  it('places the marks of a WOFF2 by the fallback, opening its outlines at the first decomposed character', async () => {
    const bytes = fixtureFontBytes('montserrat-semibold-marks-nogpos-subset.woff2');
    const sfnt = (await openFontContainer(bytes))!;
    const openOutlines = await lazyFontContainer(bytes, FALLBACK_MARK_TABLE_TAGS);

    expect(sfntDecomposition(sfnt, openOutlines)!('Ä', EM_PX)?.marks).toEqual([
      { char: '\u0308', x: 674.5, y: 144.5 },
    ]);
  });

  it('opens the outlines of a font with no GPOS script at its first decomposed character', async () => {
    const bytes = fixtureFontBytes('montserrat-semibold-marks-nogpos-subset.woff2');
    const sfnt = (await openFontContainer(bytes))!;
    const open = await lazyFontContainer(bytes, FALLBACK_MARK_TABLE_TAGS);
    const openOutlines = vi.fn(open);
    const decomposition = sfntDecomposition(sfnt, openOutlines)!;

    decomposition('A', EM_PX);
    expect(openOutlines).not.toHaveBeenCalled();
    decomposition('Ä', EM_PX);
    decomposition('Ö', EM_PX);
    expect(openOutlines).toHaveBeenCalledTimes(1);
  });
});
