/**
 * The glyph a variable font draws for a character at a `FontVariation` instance, against the glyph
 * Godot 4.6.3 shapes (`instanceGlyph.godot.json`, from `scripts/fonts/variable-advance-oracle/`).
 * HarfBuzz swaps glyphs by the `rvrn` feature of the `GSUB` `FeatureVariations` record that holds at
 * the instance. Recursive swaps them with its `MONO` and `slnt` axes, and keeps `CASL` out of it.
 */

import { describe, expect, it } from 'vitest';
import reference from './instanceGlyph.godot.json';
import { getFontRunGlyphAdvancePx, withVariation, type FontMetrics } from '../fontMetrics';
import { createRuntimeFontMetrics } from '../runtimeFontMetrics';
import { openFontOutlines } from '../sfntOutlines';
import { fixtureFontBytes } from '../sfntOutlines.testkit';
import { opentypeOf } from '../glyphVariation.testkit';
import { openFontContainer } from '../fontContainer';
import { OUTLINE_TABLE_TAGS, sfntFileOfTables, tableBytes } from '../sfntTables';
import { sfntGlyphIndex } from '../sfntCmap';
import { sfntGsub } from '../autofit/openTypeLayout';
import { instanceGlyphIndex } from './instanceGlyph';

interface ReferenceGlyph {
  font: string;
  char: string;
  sizePx: number;
  opentype: Record<string, number>;
  glyph: number;
  advancePx: number;
}

const glyphs = reference as unknown as ReferenceGlyph[];
/** Canvas measures the advance at the default instance, so only an instance reads the advance of its glyph. */
const instancedGlyphs = glyphs.filter(({ opentype }) => Object.keys(opentype).length > 0);

/** Canvas measures the default instance. It answers 0, so a result that holds it shows the instance is ignored. */
const defaultInstanceMetrics = createRuntimeFontMetrics({
  scalars: { unitsPerEm: 1000, ascent: 950, descent: 250 },
  measureWidthUnits: () => 0,
  cssFontFamily: 'recursive-variable',
  hasGlyph: () => true,
});

const title = ({ char, opentype }: ReferenceGlyph): string =>
  `${char} at variation_opentype ${JSON.stringify(opentype)}`;

const cases = (rows: readonly ReferenceGlyph[]) => rows.map((row) => [title(row), row] as const);

async function outlinesOf({ font }: ReferenceGlyph) {
  const outlines = await openFontOutlines(fixtureFontBytes(font));
  if (!outlines) throw new Error(`expected outlines in ${font}, got none`);
  return outlines;
}

describe('the glyph of a variable font at an instance', () => {
  it.each(cases(glyphs))('matches Godot for %s', async (_, row) => {
    const outlines = await outlinesOf(row);

    expect(outlines.glyphIndex(row.char.codePointAt(0)!, opentypeOf(row.opentype))).toBe(row.glyph);
  });

  it.each(cases(instancedGlyphs))(
    'takes the advance of that glyph, as Godot does, for %s',
    async (_, row) => {
      const outlines = await outlinesOf(row);
      const metrics: FontMetrics = withVariation(defaultInstanceMetrics, {
        opentype: opentypeOf(row.opentype),
        outlines,
      });

      expect(getFontRunGlyphAdvancePx(metrics, { char: row.char }, row.sizePx)).toBe(row.advancePx);
    }
  );
});

describe('the glyph of a variable font with a corrupt GSUB', () => {
  it('stays the cmap glyph where a subtable reads past the table', async () => {
    const whole = (await openFontContainer(
      fixtureFontBytes('recursive-vf-subset.woff2'),
      OUTLINE_TABLE_TAGS
    ))!;
    // Lookup 37 swaps `l` at the default instance. Its coverage offset now points past the bytes of
    // the file, because `GSUB` is the last table.
    const subtableAt = sfntGsub(whole)!.lookups[37]!.subtables[0]!.offset - whole.tables.get('GSUB')!.offset;
    const gsub = tableBytes(whole, 'GSUB').slice();
    new DataView(gsub.buffer).setUint16(subtableAt + 2, 0xffff, false);
    const tables = new Map([...whole.tables.keys()].map((tag) => [tag, tableBytes(whole, tag)] as const));
    tables.delete('GSUB');
    const corrupt = sfntFileOfTables(tables.set('GSUB', gsub));
    const cmapGlyph = sfntGlyphIndex(corrupt)!('l'.codePointAt(0)!);

    const glyphAt = instanceGlyphIndex(corrupt, sfntGlyphIndex(corrupt)!);

    expect(glyphAt('l'.codePointAt(0)!, null)).toBe(cmapGlyph);
  });
});
