/** Where Montserrat SemiBold's mark subset places the marks of a cluster, against the offsets HarfBuzz shapes (`markPositioning.test.ts`). */
import { describe, expect, it, vi } from 'vitest';
import { lazyFontContainer, openFontContainer } from './fontContainer';
import { sfntMarkOffsets } from './sfntMarkOffsets';
import { clusterGlyphs, fixtureFontBytes, fixtureSfnt } from './sfntOutlines.testkit';
import { FALLBACK_MARK_TABLE_TAGS, type SfntFile } from './sfntTables';

/** The font's em in px: a design unit is then a whole pixel, so the GPOS units read back unchanged. */
const EM_PX = 1000;

const MARKS_FONT = fixtureSfnt('montserrat-semibold-marks-subset.ttf');
const NO_GPOS_FONT = fixtureSfnt('montserrat-semibold-marks-nogpos-subset.ttf');

const offsetsIn = (sfnt: SfntFile) => {
  const offsetsOf = sfntMarkOffsets(sfnt);
  return (text: string) => offsetsOf(clusterGlyphs(sfnt, text), EM_PX);
};

describe('sfntMarkOffsets', () => {
  it('places a mark at the GPOS offset from its base', () => {
    expect(offsetsIn(MARKS_FONT)('Ä')).toEqual([
      { x: 0, y: 0 },
      { x: 674, y: 166 },
    ]);
  });

  it('stacks a second mark on the first', () => {
    expect(offsetsIn(MARKS_FONT)('Ȫ').slice(1)).toEqual([
      { x: 721, y: 166 },
      { x: 721, y: 322 },
    ]);
  });

  it('keeps the offsets of the sizes read most recently, so a size animation cannot grow the cache', () => {
    const offsetsOf = sfntMarkOffsets(MARKS_FONT);
    const cluster = clusterGlyphs(MARKS_FONT, 'Ä');
    const first = offsetsOf(cluster, 10);
    for (let size = 11; size <= 18; size++) offsetsOf(cluster, size);
    expect(offsetsOf(cluster, 18)).toBe(offsetsOf(cluster, 18));
    expect(offsetsOf(cluster, 10)).not.toBe(first);
    expect(offsetsOf(cluster, 10)).toEqual(first);
  });

  it('places the marks by the fallback where the font has no GPOS script', () => {
    expect(offsetsIn(NO_GPOS_FONT)('Ǟ').slice(1)).toEqual([
      { x: 674.5, y: 144.5 },
      { x: 674.5, y: 308 },
    ]);
  });

  it('places the marks of a WOFF2 by the fallback, from outlines it opens at the first mark', async () => {
    const bytes = fixtureFontBytes('montserrat-semibold-marks-nogpos-subset.woff2');
    const sfnt = (await openFontContainer(bytes))!;
    const openOutlines = vi.fn(await lazyFontContainer(bytes, FALLBACK_MARK_TABLE_TAGS));
    const offsetsOf = sfntMarkOffsets(sfnt, openOutlines);

    offsetsOf(clusterGlyphs(sfnt, 'A'), EM_PX);
    expect(openOutlines).not.toHaveBeenCalled();
    expect(offsetsOf(clusterGlyphs(sfnt, 'Ä'), EM_PX)[1]).toEqual({ x: 674.5, y: 144.5 });
    offsetsOf(clusterGlyphs(sfnt, 'Ö'), EM_PX);
    expect(openOutlines).toHaveBeenCalledTimes(1);
  });
});
