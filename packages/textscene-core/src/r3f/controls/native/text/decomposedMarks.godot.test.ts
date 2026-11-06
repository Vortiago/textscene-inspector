/**
 * Where a character that Montserrat's mark subsets lack draws its marks, against Godot 4.6.3:
 * `decomposedMarks.godot.json` holds the glyphs that Godot's shaper gives each character, with the
 * offset each mark takes from the pen after the base (`scripts/fonts/decomposed-marks-oracle`). The
 * four fonts differ only in their `GPOS`: whole, none, one with no mark lookup, and one with a script but no lookup at all.
 */
import { describe, expect, it } from 'vitest';
import reference from './decomposedMarks.godot.json';
import type { FontMetrics } from './fontMetrics';
import { sfntGlyphIndex, sfntHasGlyph } from './sfntCmap';
import { sfntDecomposition } from './sfntDecomposition';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import { fixtureSfnt } from './sfntOutlines.testkit';
import { parseSfntScalars } from './sfntTables';
import { glyphsOf } from './textLayout.testkit';

interface ReferenceCharacter {
  readonly font: string;
  readonly char: string;
  readonly sizePx: number;
  readonly glyphs: readonly { advance: number; offset: readonly [number, number] }[];
}

function fontMetricsOf(font: string): FontMetrics {
  const sfnt = fixtureSfnt(font);
  const { unitsPerEm, ascent, descent } = parseSfntScalars(sfnt)!;
  const glyphIndexOf = sfntGlyphIndex(sfnt)!;
  const metricsOf = glyphMetricsReader(sfnt);
  const decomposition = sfntDecomposition(sfnt) ?? undefined;
  // The browser shapes a character the font lacks as its base and marks, so its advance is the base's,
  // which does not depend on the size.
  const advanceUnits = (ch: string) =>
    metricsOf(glyphIndexOf((decomposition?.(ch, 16)?.base ?? ch).codePointAt(0)!), 0).horizontal.advance;
  return {
    kind: 'canvas',
    unitsPerEm,
    ascent,
    descent,
    hasGlyph: sfntHasGlyph(sfnt),
    getGlyphAdvanceUnits: advanceUnits,
    getKerningAdjustmentUnits: () => 0,
    averageAdvanceUnits: advanceUnits('n'),
    decomposition,
  };
}

// The JSON module types an offset as number[], not as the pair it holds.
const references = reference as unknown as ReferenceCharacter[];

describe('shapeText — the marks of a decomposed character against Godot', () => {
  it.each(references.map((row) => [`${row.char} at ${row.sizePx} px in ${row.font}`, row] as const))(
    'places %s',
    (_, { font, char, sizePx, glyphs }) => {
      const placed = glyphsOf(char, fontMetricsOf(font), sizePx);
      // Adding zero turns the layout's -0 into the 0 of the reference.
      expect(
        placed.map(({ advance, xOffset = 0, yOffset = 0 }) => ({
          advance,
          offset: [xOffset + 0, yOffset + 0],
        }))
      ).toEqual(glyphs.map(({ advance, offset }) => ({ advance, offset })));
    }
  );
});
