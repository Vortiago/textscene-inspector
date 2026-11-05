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
import { glyphMetricsReader, metricsAtInstance } from './sfntGlyphMetrics';
import type { GlyphContours, GlyphOutlineReader } from './glyphContours';
import { glyphAdvance26_6, isInstanced, type GlyphVariation, type OpentypeCoordinates } from './fontMetrics';
import { cffOutlineReader } from './sfntCff';
import { isNativelyHinted, type GlyphHinting } from './glyphHinting';
import { glyfAdvanceReader, glyphOutlineReader } from './sfntGlyf';
import { variedContours } from './glyphVariation';
import { isTrickyFont } from './trickyFont';
import { openFontContainer } from './fontContainer';
import { OUTLINE_TABLE_TAGS, readHeadUnitsPerEm, type SfntFile } from './sfntTables';
import { fontInstanceOf, type FontInstance } from './variation/fontInstance';
import type { PairKerningReader } from './variation/instanceKerning';

/** The `GPOS` kerning at the normalised coordinates of an instance, or null for a font with no `kern` feature. */
type InstanceKerningReader = (normalized: Int32Array) => PairKerningReader | null;

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
  /**
   * The `GPOS` kerning in design units of a pair of glyphs, as HarfBuzz shapes it at the axis values
   * of `opentype`: null where they draw the default instance, or the font has no `kern` feature to
   * read. Absent for outlines with no `GPOS` variation to read.
   */
  kerningAtInstance?(left: number, right: number, opentype: OpentypeCoordinates): number | null;
  /** Whether the axis values of `opentype` draw an instance other than the default. */
  drawsInstance?(opentype: OpentypeCoordinates): boolean;
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
  return readSfntOutlines(sfnt, outlineOf, await kerningReaderOf(sfnt));
}

/**
 * The `GPOS` kerning of a variable font at the coordinates of an instance. Its module loads with the
 * font, and it reads the tables when an instance first asks, so a font at its default instance reads none.
 */
async function kerningReaderOf(sfnt: SfntFile): Promise<InstanceKerningReader | null> {
  if (!sfnt.tables.has('GPOS') || !sfnt.tables.has('fvar')) return null;
  const { instanceKerningReader } = await import('./variation/instanceKerning');
  // Undefined until an instance first asks. Null is a font with no `kern` feature, read only once.
  let readerAt: ReturnType<typeof instanceKerningReader> | undefined;
  return (normalized) => {
    if (readerAt === undefined) readerAt = orOnRangeError(() => instanceKerningReader(sfnt), null);
    return readerAt?.(normalized) ?? null;
  };
}

/**
 * The kerning of each pair at an instance, kept for each axis values as a layout asks for the same
 * pair again and again. A pair that a corrupt table puts past the buffer kerns 0.
 */
function instanceKerningOf(
  sfnt: SfntFile,
  kerningAt: InstanceKerningReader | null
): SfntOutlines['kerningAtInstance'] {
  if (!kerningAt) return undefined;
  const kept = new WeakMap<OpentypeCoordinates, PairKerningReader | null>();
  return (left, right, opentype) => {
    if (!kept.has(opentype)) {
      const instance = orOnRangeError(() => fontInstanceOf(sfnt, opentype), null);
      const kerningOf = instance && kerningAt(instance.normalized);
      kept.set(opentype, kerningOf && keptPairs(kerningOf));
    }
    return kept.get(opentype)?.(left, right) ?? null;
  };
}

/** `kerningOf` with the answer for each pair kept, and 0 for a pair a corrupt table puts past the buffer. */
function keptPairs(kerningOf: PairKerningReader): PairKerningReader {
  const kept = new Map<number, number>();
  return (left, right) => {
    const pair = left * 0x10000 + right;
    let units = kept.get(pair);
    if (units === undefined) kept.set(pair, (units = orOnRangeError(() => kerningOf(left, right), 0)));
    return units;
  };
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

function readSfntOutlines(
  sfnt: SfntFile,
  outlineOf: GlyphOutlineReader | null,
  kerningAt: InstanceKerningReader | null
): SfntOutlines | null {
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
    kerningAtInstance: instanceKerningOf(sfnt, kerningAt),
    drawsInstance: (opentype) => orOnRangeError(() => fontInstanceOf(sfnt, opentype) !== null, false),
  };
}
