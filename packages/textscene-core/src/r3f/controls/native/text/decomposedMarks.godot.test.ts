/**
 * Where a character that Montserrat's mark subsets lack draws its marks, against Godot 4.6.3:
 * `decomposedMarks.godot.json` holds the glyphs that Godot's shaper gives each character, with the
 * offset each mark takes from the pen after the base (`scripts/fonts/decomposed-marks-oracle`). The
 * three fonts differ only in their `GPOS`: whole, none, and one with no mark lookup.
 */
import { describe, expect, it } from 'vitest';
import reference from './decomposedMarks.godot.json';
import type { FontMetrics } from './fontMetrics';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { sfntGlyphIndex, sfntHasGlyph } from './sfntCmap';
import { sfntDecomposition } from './sfntDecomposition';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { openSfnt, parseSfntScalars } from './sfntTables';
import { shapeText } from './textLayout';

interface ReferenceCharacter {
  readonly font: string;
  readonly char: string;
  readonly sizePx: number;
  readonly glyphs: readonly { advance: number; offset: readonly [number, number] }[];
}

function fontMetricsOf(font: string): FontMetrics {
  const sfnt = openSfnt(fixtureFontBytes(font))!;
  const { unitsPerEm, ascent, descent } = parseSfntScalars(sfnt)!;
  const glyphIndexOf = sfntGlyphIndex(sfnt)!;
  const metricsOf = glyphMetricsReader(sfnt);
  const decomposition = sfntDecomposition(sfnt) ?? undefined;
  // The browser shapes a character the font lacks as its base and marks, so its advance is the base's.
  const advanceUnits = (ch: string) =>
    metricsOf(glyphIndexOf((decomposition?.(ch)?.base ?? ch).codePointAt(0)!), 0).horizontal.advance;
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

const references = reference as ReferenceCharacter[];

describe('shapeText — the marks of a decomposed character against Godot', () => {
  it.each(references.map((row) => [`${row.char} at ${row.sizePx} px in ${row.font}`, row] as const))(
    'places %s',
    (_, { font, char, sizePx, glyphs }) => {
      const [placed] = shapeText(char, {
        fontSizePx: sizePx,
        boxWidthPx: 0,
        autowrapMode: AutowrapMode.AUTOWRAP_OFF,
        lineSpacingPx: 0,
        fontMetrics: fontMetricsOf(font),
      }).lines[0]!.glyphs;

      const [base, ...marks] = glyphs;
      expect(placed!.advance).toBe(base!.advance);
      // Godot offsets a mark from the pen after the base, in y down; the placement is from the base's origin.
      // Adding zero turns the layout's -0 into the 0 of the reference.
      expect(placed!.decomposition!.marks.map(({ x, y }) => [x + 0, y + 0])).toEqual(
        marks.map(({ offset: [x, y] }) => [base!.advance + x, y])
      );
    }
  );
});
