/** Whether a font maps a character to a glyph, as FreeType's `FT_Get_Char_Index` answers the shaper. */
import { describe, expect, it } from 'vitest';
import { sfntHasGlyph } from './sfntCmap';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { openSfnt } from './sfntTables';

/** Open Sans SemiBold with `maxp.numGlyphs` set to `glyphCount`. */
function openSansWithGlyphCount(glyphCount: number) {
  const bytes = fixtureFontBytes('open-sans-semibold-subset.ttf').slice(0);
  const maxp = openSfnt(bytes)!.tables.get('maxp')!;
  new DataView(bytes).setUint16(maxp.offset + 4, glyphCount, false);
  return openSfnt(bytes)!;
}

describe('sfntHasGlyph', () => {
  it('has a glyph for a character the cmap maps', () => {
    expect(sfntHasGlyph(openSfnt(fixtureFontBytes('open-sans-semibold-subset.ttf'))!)('A')).toBe(true);
  });

  it('has no glyph for a character the cmap does not map', () => {
    expect(sfntHasGlyph(openSfnt(fixtureFontBytes('open-sans-semibold-subset.ttf'))!)('א')).toBe(false);
  });

  // `FT_Get_Char_Index` answers 0 for an index at or past `num_glyphs`.
  it('has no glyph for a character the cmap maps past the last glyph', () => {
    expect(sfntHasGlyph(openSansWithGlyphCount(1))('A')).toBe(false);
  });

  // HarfBuzz decomposes a character the font lacks into the base and marks it has, and draws them
  // (`hb-ot-shape-normalize.cc`, `decompose_current_character`). The font keeps no `Ä`, only `A` and U+0308.
  describe('for a character the cmap lacks but its canonical decomposition has', () => {
    const marksFont = () => openSfnt(fixtureFontBytes('montserrat-semibold-marks-subset.ttf'))!;

    it('has a glyph for a base and a mark', () => {
      expect(sfntHasGlyph(marksFont())('Ä')).toBe(true);
    });

    it('has a glyph where the decomposition goes through a composite the font lacks', () => {
      expect(sfntHasGlyph(marksFont())('Ǟ')).toBe(true);
    });

    it('has no glyph where one mark of the decomposition is missing', () => {
      expect(sfntHasGlyph(marksFont())('Ç')).toBe(false);
    });
  });
});
