/**
 * The glyphs a face of a font file draws, as `FontMetrics` reads them: the run shaping, the mark
 * offsets and the default `GPOS` kerning of a pair of shaped glyphs.
 */

import type { FaceGlyphs, GlyphKerningReader } from './fontMetrics';
import { sfntRunShaping } from './glyphRun';
import { keptPairs } from './keptPairs';
import { sfntMarkOffsets } from './sfntMarkOffsets';
import { orOnRangeError } from './sfntCmap';
import type { SfntFile } from './sfntTables';
import type { defaultKerningReader, PairKerningReader } from './variation/instanceKerning';

/**
 * The glyphs of `sfnt`. `openOutlines` opens the font with its outlines at the first mark that
 * reads them. `kerningOf` reads the default `GPOS` kerning of a pair of glyphs at the first pair,
 * and is absent where the font has no `GPOS`.
 */
export function sfntFaceGlyphs(
  sfnt: SfntFile,
  openOutlines: () => SfntFile | null = () => sfnt,
  kerningOf?: typeof defaultKerningReader
): FaceGlyphs {
  return {
    shaping: sfntRunShaping(sfnt) ?? undefined,
    markOffsets: sfntMarkOffsets(sfnt, openOutlines),
    getGlyphKerning: kerningOf && lazyKerning(() => orOnRangeError(() => kerningOf(sfnt), null)),
  };
}

/**
 * `read`'s kerning, read at the first pair and kept by pair. Null, not zero, for a font with no pair
 * kerning: HarfBuzz then applies the legacy `kern` table, which the kerning of the characters holds.
 */
function lazyKerning(read: () => PairKerningReader | null): GlyphKerningReader {
  let kerningOf: PairKerningReader | null | undefined;
  return (left, right) => {
    if (kerningOf === undefined) {
      const reader = read();
      kerningOf = reader && keptPairs(reader);
    }
    return kerningOf ? kerningOf(left, right) : null;
  };
}
