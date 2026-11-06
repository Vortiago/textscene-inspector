/**
 * The glyph a variable font draws for a character at a `FontVariation` instance, against the glyph
 * Godot 4.6.3 shapes (`instanceGlyph.godot.json`, from `scripts/fonts/variable-advance-oracle/`).
 * HarfBuzz swaps glyphs by the `rvrn` feature of the `GSUB` `FeatureVariations` record that holds at
 * the instance. Recursive swaps them with its `MONO` and `slnt` axes, and keeps `CASL` out of it.
 */

import { describe, expect, it } from 'vitest';
import reference from './instanceGlyph.godot.json';
import { getFontGlyphAdvancePx, withVariation, type FontMetrics } from '../fontMetrics';
import { createRuntimeFontMetrics } from '../runtimeFontMetrics';
import { openFontOutlines } from '../sfntOutlines';
import { fixtureFontBytes } from '../sfntOutlines.testkit';
import { opentypeOf } from '../glyphVariation.testkit';

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

      expect(getFontGlyphAdvancePx(metrics, row.char, row.sizePx)).toBe(row.advancePx);
    }
  );
});
