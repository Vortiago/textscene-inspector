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
});
