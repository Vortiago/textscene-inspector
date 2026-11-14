/** A face that reads every number of a font file from its tables, for a test of the shaped arm. */

import type { FontMetrics } from './fontMetrics';
import { sfntGlyphIndex, sfntHasGlyph } from './sfntCmap';
import { sfntFaceGlyphs } from './sfntFaceGlyphs';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import { parseSfntScalars, type SfntFile } from './sfntTables';
import { defaultKerningReader } from './variation/instanceKerning';

/**
 * The face of `sfnt` with its run shaping, its mark offsets and its `GPOS` kerning. The scene-font
 * loader's face measures its kerning on a canvas, which carries the same `GPOS` pairs.
 */
export function sfntFace(sfnt: SfntFile): FontMetrics {
  const { unitsPerEm, ascent, descent } = parseSfntScalars(sfnt)!;
  const glyphIndexOf = sfntGlyphIndex(sfnt)!;
  const metricsOf = glyphMetricsReader(sfnt);
  const advanceUnits = (ch: string) => metricsOf(glyphIndexOf(ch.codePointAt(0)!), 0).horizontal.advance;
  // One kerning reader, built at the first pair: `getKerningAdjustmentUnits` and `sfntFaceGlyphs` share it.
  // Undefined, not null, until then: null is a font with no pair kerning, which is not read again.
  let kerning: ReturnType<typeof defaultKerningReader> | undefined;
  const kerningOf = () => {
    if (kerning === undefined) kerning = defaultKerningReader(sfnt);
    return kerning;
  };
  const lookupGlyph = (ch: string) => {
    const codePoint = ch.codePointAt(0)!;
    return { glyph: glyphIndexOf(codePoint), codePoint };
  };
  return {
    kind: 'canvas',
    unitsPerEm,
    ascent,
    descent,
    hasGlyph: sfntHasGlyph(sfnt),
    getGlyphAdvanceUnits: advanceUnits,
    getKerningAdjustmentUnits: (a, b) =>
      (kerningOf()?.(lookupGlyph(a), lookupGlyph(b)) ?? []).reduce((units, value) => units + value.units, 0),
    averageAdvanceUnits: advanceUnits('n'),
    ...sfntFaceGlyphs(sfnt, () => sfnt, kerningOf),
  };
}
