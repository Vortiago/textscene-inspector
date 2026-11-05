/**
 * A font's glyph outlines as Godot's text server loads them for TextMesh and for its glyph bitmaps:
 * the glyph index of a character from `cmap` (`sfntCmap.ts`), and the points of that glyph from
 * `glyf` (`sfntGlyf.ts`) or from `CFF ` and `CFF2` (`sfntCff.ts`). A WOFF or WOFF2 opens through
 * `fontContainer.ts`, which hands the readers the plain tables. The bytecode interpreter
 * (`truetype/trueTypeHinting.ts`) and the auto-hinter (`autofit/autoHinter.ts`) load on demand.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { FontHinting } from '../../../../godot/text/textServerEnums';
import { cmapLookup } from './sfntCmap';
import { glyphMetricsReader, metricsAtInstance } from './sfntGlyphMetrics';
import type { GlyphContours, GlyphOutlineReader } from './glyphContours';
import { glyphAdvance26_6, isInstanced, type GlyphVariation, type OpentypeCoordinates } from './fontMetrics';
import { cffOutlineReader, unhintedCffOutlineReader } from './sfntCff';
import { isNativelyHinted, type GlyphHinting } from './glyphHinting';
import { glyfAdvanceReader, glyphOutlineReader } from './sfntGlyf';
import { variedContours } from './glyphVariation';
import { isTrickyFont } from './trickyFont';
import { openFontContainer } from './fontContainer';
import { OUTLINE_TABLE_TAGS, readHeadUnitsPerEm, type SfntFile } from './sfntTables';
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

/** How a font's glyphs load: its `hinting` (`text_server_adv.cpp:1270-1282`), and `force_autohinter`. */
export interface GlyphLoad {
  hinting: FontHinting;
  isAutohinterForced: boolean;
}

/** The load of `font_get_glyph_contours`, which a TextMesh extrudes: the normal target (`text_server_adv.cpp:3613`). */
export const CONTOUR_LOAD: GlyphLoad = { hinting: 'normal', isAutohinterForced: false };

/**
 * Reads the outlines of a TrueType or OpenType-CFF font in a plain, WOFF or WOFF2 file, or returns
 * `null`, never throws, for a font with no `glyf` or CFF table, no readable `cmap` or a table that
 * does not fit its buffer. The reader answers no glyph, not an error, for an offset a corrupt table
 * puts past the buffer. Each glyph loads as `load` asks.
 */
export async function openFontOutlines(
  bytes: ArrayBuffer,
  load: GlyphLoad = CONTOUR_LOAD
): Promise<SfntOutlines | null> {
  const sfnt = await openFontContainer(bytes, OUTLINE_TABLE_TAGS);
  if (!sfnt) return null;
  return readSfntOutlines(sfnt, await outlineReaderOf(sfnt, load));
}

/**
 * The reader `FT_Load_Glyph` picks for `load` (`ftobjs.c:976-1016`): no hinting reads the outline as
 * it is. A tricky font hints itself. Otherwise the auto-hinter takes a forced load, a TrueType font
 * at the light target, since its driver does not hint lightly, and a TrueType font without hints.
 */
async function outlineReaderOf(sfnt: SfntFile, load: GlyphLoad): Promise<GlyphOutlineReader | null> {
  if (load.hinting === 'none') return unhintedReaderOf(sfnt);
  if (isTrickyFont(sfnt)) return nativeReaderOf(sfnt);
  const isTrueType = sfnt.tables.has('glyf');
  const isAutoHinted =
    load.isAutohinterForced || (isTrueType && (load.hinting === 'light' || !isNativelyHinted(sfnt)));
  return isAutoHinted ? autoHintedReaderOf(sfnt, load.hinting) : nativeReaderOf(sfnt);
}

/** The reader of a font's outlines scaled with no hints, as `FT_LOAD_NO_HINTING` loads them. */
function unhintedReaderOf(sfnt: SfntFile): GlyphOutlineReader | null {
  return glyphOutlineReader(sfnt, null) ?? unhintedCffOutlineReader(sfnt);
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

/**
 * The auto-hinter's reader for the target `hinting`, which hints a variable font at the instance that
 * its glyphs and blue zones follow.
 */
async function autoHintedReaderOf(sfnt: SfntFile, hinting: FontHinting): Promise<GlyphOutlineReader | null> {
  const { autoHintedReader } = await import('./autofit/autoHinter');
  return orOnRangeError(() => autoHintedReader(sfnt, hinting === 'light' ? 'light' : 'normal'), null);
}

/** The font at the axis values of `variation`, or null for the default instance. */
function instanceOf(sfnt: SfntFile, variation: GlyphVariation | undefined): FontInstance | null {
  return isInstanced(variation?.opentype) ? fontInstanceOf(sfnt, variation.opentype) : null;
}

/**
 * The advance in 26.6 of each glyph of `sfnt` at an instance. FreeType takes it from `hmtx` and
 * `HVAR` where the font has `HVAR` (`tt_get_advances`), and else from the phantom points of an
 * unhinted load. The readers are built once per font and each answer is kept, as a layout asks
 * for the same glyph at the same size again and again.
 */
function instanceAdvanceReader(sfnt: SfntFile): SfntOutlines['advanceAtInstance'] {
  let readers: ReturnType<typeof instanceAdvanceReaders> | undefined;
  const kept = new WeakMap<OpentypeCoordinates, Map<number, Map<number, number | null>>>();

  return (glyphIndex, fontSizePx, opentype) => {
    let bySize = kept.get(opentype);
    if (!bySize) kept.set(opentype, (bySize = new Map()));
    let byGlyph = bySize.get(fontSizePx);
    if (!byGlyph) {
      // A font size animation passes through many sizes, so the oldest size goes at this count.
      if (bySize.size >= MAX_KEPT_SIZES) bySize.delete(bySize.keys().next().value!);
      bySize.set(fontSizePx, (byGlyph = new Map()));
    }
    if (byGlyph.has(glyphIndex)) return byGlyph.get(glyphIndex)!;
    const instance = fontInstanceOf(sfnt, opentype);
    readers ??= instanceAdvanceReaders(sfnt);
    const advance = instance && orOnRangeError(() => readers!(instance, glyphIndex, fontSizePx), null);
    byGlyph.set(glyphIndex, advance);
    return advance;
  };
}

/** The sizes of one instance whose advances are kept. */
const MAX_KEPT_SIZES = 8;

/** The reader of the 26.6 advance at an instance, with `hmtx`, `head` and the phantom-point loader set up once. */
function instanceAdvanceReaders(
  sfnt: SfntFile
): (instance: FontInstance, glyphIndex: number, fontSizePx: number) => number | null {
  const metricsOf = glyphMetricsReader(sfnt);
  const unitsPerEm = readHeadUnitsPerEm(sfnt);
  const phantomAdvance = glyfAdvanceReader(sfnt);
  return (instance, glyphIndex, fontSizePx) => {
    if (!instance.adjustedAdvances.horizontal)
      return phantomAdvance?.(glyphIndex, fontSizePx, instance) ?? null;
    const { advance } = metricsAtInstance(metricsOf(glyphIndex, 0), instance, glyphIndex).horizontal;
    return glyphAdvance26_6(advance, unitsPerEm, fontSizePx);
  };
}

function readSfntOutlines(sfnt: SfntFile, outlineOf: GlyphOutlineReader | null): SfntOutlines | null {
  const cmap = sfnt.tables.get('cmap');
  if (!cmap || !outlineOf) return null;
  const lookup = orOnRangeError(() => cmapLookup(sfnt.dv, cmap.offset), null);
  if (!lookup) return null;

  return {
    glyphIndex: (codePoint) => orOnRangeError(() => lookup(codePoint), 0),
    advanceAtInstance: instanceAdvanceReader(sfnt),
    glyphContours: (glyphIndex, fontSizePx, variation) =>
      orOnRangeError(() => {
        const outline = outlineOf(glyphIndex, fontSizePx, instanceOf(sfnt, variation));
        return outline && variedContours(outline, fontSizePx, variation);
      }, null),
  };
}
