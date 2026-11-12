/**
 * The vendored Open Sans SemiBold as a `FontMetrics`: the native text engine's default, which a
 * scene with no `Theme` or `font` override shapes against.
 */

import { decodeBase64UrlBytes } from '../../../../godot/variant/packedBytes';
import type { FaceGlyphs, FontMetrics } from './fontMetrics';
import { OPEN_SANS_METRICS, getKerningAdjustmentUnits } from './openSansMetrics';
import { OPEN_SANS_SHAPING_TABLES } from './openSansShaping';
import { sfntGlyphIndex, sfntHasGlyph } from './sfntCmap';
import { sfntFaceGlyphs } from './sfntFaceGlyphs';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import { sfntFileOfTables, type SfntFile } from './sfntTables';

/** Written once, by the first read of the baked tables. */
let sfnt: SfntFile | undefined;

/** The baked shaping tables of Open Sans as a font file, decoded at the first read. They hold no outlines. */
function openSansShapingSfnt(): SfntFile {
  if (sfnt) return sfnt;
  const tables = Object.entries(OPEN_SANS_SHAPING_TABLES).map(
    ([tag, base64url]) => [tag, decodeBase64UrlBytes(base64url)] as const
  );
  sfnt = sfntFileOfTables(new Map(tables));
  return sfnt;
}

/** Written once, by the first read of a glyph field of `OPEN_SANS_FONT_METRICS`. */
let glyphs: FaceGlyphs | undefined;

/** The glyphs of the baked tables, read at the first run that reads them. */
function openSansGlyphs(): FaceGlyphs {
  if (glyphs) return glyphs;
  const { shaping, markOffsets } = sfntFaceGlyphs(openSansShapingSfnt());
  glyphs = { shaping, markOffsets };
  return glyphs;
}

/** What the baked `cmap` and `hmtx` answer for a character. */
interface FaceCharacters {
  hasGlyph(ch: string): boolean;
  /** The `hmtx` advance of the glyph the `cmap` maps `ch` to. Null, not the advance of `.notdef`, for no glyph. */
  advanceUnits(ch: string): number | null;
}

/** Written once, by the first read of a character of `OPEN_SANS_FONT_METRICS`. */
let characters: FaceCharacters | undefined;

/** The characters of the baked tables: every code point of the font, as a scene font reads its file. */
function openSansCharacters(): FaceCharacters {
  if (characters) return characters;
  const sfnt = openSansShapingSfnt();
  const glyphIndexOf = sfntGlyphIndex(sfnt);
  if (!glyphIndexOf) throw new Error('expected a Unicode cmap subtable in the baked tables, got none');
  const metricsOf = glyphMetricsReader(sfnt);
  characters = {
    hasGlyph: sfntHasGlyph(sfnt),
    advanceUnits: (ch) => {
      const glyph = glyphIndexOf(ch.codePointAt(0)!);
      return glyph === 0 ? null : metricsOf(glyph, 0).horizontal.advance;
    },
  };
  return characters;
}

// The scalars read through to the GENERATED `openSansMetrics.ts` with getters, not a snapshot, so
// a live mutation (as `textLayout.test.ts` makes to `.kerning`) stays visible.
export const OPEN_SANS_FONT_METRICS: FontMetrics = {
  kind: 'bundled',
  get unitsPerEm() {
    return OPEN_SANS_METRICS.unitsPerEm;
  },
  get ascent() {
    return OPEN_SANS_METRICS.ascent;
  },
  get descent() {
    return OPEN_SANS_METRICS.descent;
  },
  hasGlyph: (ch) => openSansCharacters().hasGlyph(ch),
  getGlyphAdvanceUnits: (ch) => openSansCharacters().advanceUnits(ch),
  getKerningAdjustmentUnits,
  get averageAdvanceUnits() {
    return OPEN_SANS_METRICS.averageAdvanceUnits;
  },
  get shaping() {
    return openSansGlyphs().shaping;
  },
  get markOffsets() {
    return openSansGlyphs().markOffsets;
  },
};
