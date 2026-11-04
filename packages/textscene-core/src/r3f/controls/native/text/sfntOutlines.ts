/**
 * A font's glyph outlines as Godot's text server hands them to TextMesh: the glyph index of a
 * character from `cmap` (`sfntCmap.ts`), and the points of that glyph from `glyf` (`sfntGlyf.ts`) or
 * from `CFF ` and `CFF2` (`sfntCff.ts`). A WOFF or WOFF2 opens through `fontContainer.ts`, which
 * hands the readers the plain tables. A TrueType font that FreeType hints natively loads the bytecode
 * interpreter (`truetype/trueTypeHinting.ts`) on demand, which hints each `glyf` outline, and any
 * other TrueType font loads the auto-hinter (`autofit/autoHinter.ts`) on demand.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { cmapLookup } from './sfntCmap';
import type { GlyphContours, GlyphOutlineReader } from './glyphContours';
import type { GlyphVariation } from './fontMetrics';
import { cffOutlineReader } from './sfntCff';
import { isNativelyHinted, type GlyphHinting } from './glyphHinting';
import { glyphOutlineReader } from './sfntGlyf';
import { variedContours } from './glyphVariation';
import { isTrickyFont } from './trickyFont';
import { openFontContainer } from './fontContainer';
import { OUTLINE_TABLE_TAGS, type SfntFile } from './sfntTables';

export interface SfntOutlines {
  /** The glyph index `cmap` gives `codePoint`, or 0 for a character the font lacks. */
  glyphIndex(codePoint: number): number;
  /** The contours of a glyph at `fontSizePx`, changed by `variation`, or null for a glyph with no outline. */
  glyphContours(glyphIndex: number, fontSizePx: number, variation?: GlyphVariation): GlyphContours | null;
}

/** `read`, or `fallback` when a corrupt table puts an offset past the buffer: a `DataView` read throws a `RangeError` there. */
function orOnRangeError<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return fallback;
  }
}

/**
 * Reads the outlines of a TrueType or OpenType-CFF font in a plain, WOFF or WOFF2 file, or returns
 * `null`, never throws, for a font with no `glyf` or CFF table, no readable `cmap` or a table that
 * does not fit its buffer. The reader answers no glyph, not an error, for an offset a corrupt table
 * puts past the buffer. A `glyf` font without its own hints loads through the auto-hinter.
 */
export function openFontOutlines(bytes: ArrayBuffer): Promise<SfntOutlines | null> {
  return openOutlines(bytes, isNativelyHinted);
}

/**
 * `openFontOutlines` for a `FontFile` with `force_autohinter` on: a `glyf` font loads through the
 * auto-hinter even with its own hints, unless it is tricky (`ftobjs.c`, `FT_Load_Glyph`).
 */
export function openAutoHintedFontOutlines(bytes: ArrayBuffer): Promise<SfntOutlines | null> {
  return openOutlines(bytes, isTrickyFont);
}

async function openOutlines(
  bytes: ArrayBuffer,
  isHintedNatively: (sfnt: SfntFile) => boolean
): Promise<SfntOutlines | null> {
  const sfnt = await openFontContainer(bytes, OUTLINE_TABLE_TAGS);
  if (!sfnt) return null;
  const glyfReader = isHintedNatively(sfnt)
    ? glyphOutlineReader(sfnt, await glyphHintingOf(sfnt))
    : await autoHintedReaderOf(sfnt);
  return readSfntOutlines(sfnt, glyfReader ?? cffOutlineReader(sfnt));
}

/** The TrueType hinting of a natively hinted `glyf` font, or null for a font FreeType does not hint so. */
async function glyphHintingOf(sfnt: SfntFile): Promise<GlyphHinting | null> {
  if (!sfnt.tables.has('glyf')) return null;
  const { trueTypeHinting } = await import('./truetype/trueTypeHinting');
  return orOnRangeError(() => trueTypeHinting(sfnt), null);
}

/** The auto-hinted reader of a `glyf` font, or null for another font. */
async function autoHintedReaderOf(sfnt: SfntFile): Promise<GlyphOutlineReader | null> {
  if (!sfnt.tables.has('glyf')) return null;
  const { autoHintedGlyfReader } = await import('./autofit/autoHinter');
  return orOnRangeError(() => autoHintedGlyfReader(sfnt), null);
}

function readSfntOutlines(sfnt: SfntFile, outlineOf: GlyphOutlineReader | null): SfntOutlines | null {
  const cmap = sfnt.tables.get('cmap');
  if (!cmap || !outlineOf) return null;
  const lookup = orOnRangeError(() => cmapLookup(sfnt.dv, cmap.offset), null);
  if (!lookup) return null;

  return {
    glyphIndex: (codePoint) => orOnRangeError(() => lookup(codePoint), 0),
    glyphContours: (glyphIndex, fontSizePx, variation) =>
      orOnRangeError(() => {
        const outline = outlineOf(glyphIndex, fontSizePx);
        return outline && variedContours(outline, fontSizePx, variation);
      }, null),
  };
}
