/**
 * A font's glyph outlines as Godot's text server hands them to TextMesh: the glyph index of a
 * character from `cmap` (`sfntCmap.ts`), and the points of that glyph from `glyf` (`sfntGlyf.ts`) or
 * from `CFF ` and `CFF2` (`sfntCff.ts`). A WOFF or WOFF2 opens through `fontContainer.ts`, which
 * hands the readers the plain tables. A TrueType font that FreeType hints natively loads the bytecode
 * interpreter (`truetype/trueTypeHinting.ts`) on demand, which hints each `glyf` outline. Any
 * other TrueType font, and any font that forces it, loads the auto-hinter (`autofit/autoHinter.ts`)
 * on demand.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { cmapLookup } from './sfntCmap';
import { glyphAdvance26_6 } from './fontMetrics';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import type { GlyphContours, GlyphOutlineReader } from './glyphContours';
import type { GlyphVariation, OpentypeCoordinates } from './fontMetrics';
import { cffOutlineReader } from './sfntCff';
import { isNativelyHinted, type GlyphHinting } from './glyphHinting';
import { glyfAdvanceReader, glyphOutlineReader } from './sfntGlyf';
import { variedContours } from './glyphVariation';
import { isTrickyFont } from './trickyFont';
import { openFontContainer } from './fontContainer';
import { OUTLINE_TABLE_TAGS, readHeadUnitsPerEm, type SfntFile } from './sfntTables';
import { toUint16 } from '../../../../godot/variant/intWidth';
import { fontInstanceOf, type FontInstance } from './variation/fontInstance';

export interface SfntOutlines {
  /** The glyph index `cmap` gives `codePoint`, or 0 for a character the font lacks. */
  glyphIndex(codePoint: number): number;
  /** The contours of a glyph at `fontSizePx`, changed by `variation`, or null for a glyph with no outline. */
  glyphContours(glyphIndex: number, fontSizePx: number, variation?: GlyphVariation): GlyphContours | null;
  /**
   * The advance in 26.6 of a glyph at `fontSizePx`, as HarfBuzz shapes it at the axis values of
   * `opentype`: null when the glyph stays at the default instance's advance. Absent for outlines of
   * a font with no variation axes to set, such as a BMFont's.
   */
  advanceAtInstance?(glyphIndex: number, fontSizePx: number, opentype: OpentypeCoordinates): number | null;
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
  return openOutlines(bytes, (sfnt) => sfnt.tables.has('glyf') && !isNativelyHinted(sfnt));
}

/**
 * `openFontOutlines` for a `FontFile` with `force_autohinter` on: any font loads through the
 * auto-hinter, even with its own hints, unless it is tricky (`ftobjs.c`, `FT_Load_Glyph`).
 */
export function openAutoHintedFontOutlines(bytes: ArrayBuffer): Promise<SfntOutlines | null> {
  return openOutlines(bytes, (sfnt) => !isTrickyFont(sfnt));
}

async function openOutlines(
  bytes: ArrayBuffer,
  isAutoHinted: (sfnt: SfntFile) => boolean
): Promise<SfntOutlines | null> {
  const sfnt = await openFontContainer(bytes, OUTLINE_TABLE_TAGS);
  if (!sfnt) return null;
  const outlineOf = isAutoHinted(sfnt) ? await autoHintedReaderOf(sfnt) : await nativeReaderOf(sfnt);
  return readSfntOutlines(sfnt, outlineOf);
}

/** The reader of a font's outlines as its own hints place them: TrueType bytecode or CFF hints. */
async function nativeReaderOf(sfnt: SfntFile): Promise<GlyphOutlineReader | null> {
  return glyphOutlineReader(sfnt, await glyphHintingOf(sfnt)) ?? cffOutlineReader(sfnt);
}

/** The TrueType hinting of a natively hinted `glyf` font, or null for a font FreeType does not hint so. */
async function glyphHintingOf(sfnt: SfntFile): Promise<GlyphHinting | null> {
  if (!sfnt.tables.has('glyf') || !isNativelyHinted(sfnt)) return null;
  const { trueTypeHinting } = await import('./truetype/trueTypeHinting');
  return orOnRangeError(() => trueTypeHinting(sfnt), null);
}

/** The auto-hinter's reader, which hints a variable font at the instance that its glyphs and blue zones follow. */
async function autoHintedReaderOf(sfnt: SfntFile): Promise<GlyphOutlineReader | null> {
  const { autoHintedReader } = await import('./autofit/autoHinter');
  return orOnRangeError(() => autoHintedReader(sfnt), null);
}

/** The font at the axis values of `variation`, or null for the default instance. */
function instanceOf(sfnt: SfntFile, variation: GlyphVariation | undefined): FontInstance | null {
  return variation?.opentype?.size ? fontInstanceOf(sfnt, variation.opentype) : null;
}

/**
 * A glyph's advance in 26.6 at `instance`. FreeType takes it from `hmtx` and `HVAR` where the font
 * has `HVAR` (`tt_get_advances`), and else from the phantom points of an unhinted load.
 */
function instanceAdvance(
  sfnt: SfntFile,
  instance: FontInstance | null,
  glyphIndex: number,
  fontSizePx: number
): number | null {
  if (!instance) return null;
  if (instance.adjustedAdvances.horizontal) {
    const { advance } = glyphMetricsReader(sfnt)(glyphIndex, 0).horizontal;
    const units = toUint16(advance + instance.advanceDelta.horizontal(glyphIndex));
    return glyphAdvance26_6(units, readHeadUnitsPerEm(sfnt), fontSizePx);
  }
  return glyfAdvanceReader(sfnt)?.(glyphIndex, fontSizePx, instance) ?? null;
}

function readSfntOutlines(sfnt: SfntFile, outlineOf: GlyphOutlineReader | null): SfntOutlines | null {
  const cmap = sfnt.tables.get('cmap');
  if (!cmap || !outlineOf) return null;
  const lookup = orOnRangeError(() => cmapLookup(sfnt.dv, cmap.offset), null);
  if (!lookup) return null;

  return {
    glyphIndex: (codePoint) => orOnRangeError(() => lookup(codePoint), 0),
    advanceAtInstance: (glyphIndex, fontSizePx, opentype) =>
      orOnRangeError(
        () => instanceAdvance(sfnt, fontInstanceOf(sfnt, opentype), glyphIndex, fontSizePx),
        null
      ),
    glyphContours: (glyphIndex, fontSizePx, variation) =>
      orOnRangeError(() => {
        const outline = outlineOf(glyphIndex, fontSizePx, instanceOf(sfnt, variation));
        return outline && variedContours(outline, fontSizePx, variation);
      }, null),
  };
}
