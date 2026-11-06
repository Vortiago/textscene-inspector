/**
 * The glyphs a face of a font file draws, as `FontMetrics` reads them: the run shaping, the mark
 * offsets, the kerning of a substituted glyph and the contours of one.
 */

import type { FaceGlyphs } from './fontMetrics';
import { sfntRunShaping } from './glyphRun';
import { sfntMarkOffsets } from './sfntMarkOffsets';
import { orOnRangeError } from './sfntCmap';
import type { SfntFile } from './sfntTables';
import { unhintedContoursReader } from './unhintedGlyphContours';
import type { defaultKerningReader, PairKerningReader } from './variation/instanceKerning';

/**
 * The glyphs of `sfnt`. `openOutlines` opens the font with its outlines at the first mark or
 * substituted glyph that reads them. `kerningOf` reads the default `GPOS` kerning of a pair of
 * glyphs at the first pair with a substituted glyph, and is absent where no such pair kerns.
 */
export function sfntFaceGlyphs(
  sfnt: SfntFile,
  openOutlines: () => SfntFile | null = () => sfnt,
  kerningOf?: typeof defaultKerningReader
): FaceGlyphs {
  return {
    shaping: sfntRunShaping(sfnt) ?? undefined,
    markOffsets: sfntMarkOffsets(sfnt, openOutlines),
    getGlyphKerningUnits: kerningOf && lazyKerning(() => orOnRangeError(() => kerningOf(sfnt), null)),
    glyphContours: unhintedContoursReader(openOutlines),
  };
}

/** `read`'s kerning, read at the first pair: most text kerns no substituted glyph. */
function lazyKerning(read: () => PairKerningReader | null): PairKerningReader {
  let kerningOf: PairKerningReader | null | undefined;
  return (left, right) => {
    if (kerningOf === undefined) kerningOf = read();
    return kerningOf ? orOnRangeError(() => kerningOf!(left, right), 0) : 0;
  };
}
