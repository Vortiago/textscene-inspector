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
import type { instanceKerningReader, PairKerningReader } from './variation/instanceKerning';
import { perObject } from '../../../../utils/perObject';
import { recentlyRead } from '../../../../utils/recentlyRead';

type InstanceKerningReader = typeof instanceKerningReader;

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
   * The `GPOS` kerning in design units of a pair of characters, as HarfBuzz shapes it at the axis
   * values of `opentype`: null where they draw the default instance, where the font has no `kern`
   * feature to read, and for a character it has no glyph for. Absent for outlines with no `GPOS`
   * variation to read.
   */
  kerningAtInstance?(
    leftCodePoint: number,
    rightCodePoint: number,
    opentype: OpentypeCoordinates
  ): number | null;
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
  const [outlineOf, kerningReader] = await Promise.all([
    isAutoHinted(sfnt) ? autoHintedReaderOf(sfnt) : nativeReaderOf(sfnt),
    kerningReaderOf(sfnt),
  ]);
  return readSfntOutlines(sfnt, outlineOf, kerningReader);
}

/**
 * The `GPOS` kerning reader of a variable font, or null for a font without `GPOS` and `fvar`. Its
 * module loads with the font, and `instanceKerningOf` reads the tables when an instance first asks.
 */
async function kerningReaderOf(sfnt: SfntFile): Promise<InstanceKerningReader | null> {
  if (!sfnt.tables.has('GPOS') || !sfnt.tables.has('fvar')) return null;
  return (await import('./variation/instanceKerning')).instanceKerningReader;
}

/** The kerning of a pair of characters at one instance, or null for a character the font has no glyph for. */
type CharacterKerning = (leftCodePoint: number, rightCodePoint: number) => number | null;

/**
 * The kerning of each pair at an instance, kept for each instance as a layout asks for the same pair
 * again and again. A font at its default instance reads no table. A pair that a corrupt table puts
 * past the buffer kerns 0.
 */
function instanceKerningOf(
  sfnt: SfntFile,
  glyphIndex: (codePoint: number) => number,
  kerningReader: InstanceKerningReader | null
): SfntOutlines['kerningAtInstance'] {
  if (!kerningReader) return undefined;
  // Read when an instance first asks. Null is a font with no pair kerning, read only once.
  const kerningAtOf = perObject((font: SfntFile) => orOnRangeError(() => kerningReader(font), null));
  // Kept with its instance, which `fontInstanceOf` bounds.
  const pairsAt = perObject((instance: FontInstance): CharacterKerning | null => {
    const kerningAt = kerningAtOf(sfnt);
    return kerningAt && keptPairs(glyphIndex, kerningAt(instance.normalized));
  });
  // Equal axis values share one instance, and so one kept pair for each pair.
  const instanceAt = perObject((opentype: OpentypeCoordinates) =>
    orOnRangeError(() => fontInstanceOf(sfnt, opentype), null)
  );
  return (leftCodePoint, rightCodePoint, opentype) => {
    const instance = instanceAt(opentype);
    return (instance && pairsAt(instance)?.(leftCodePoint, rightCodePoint)) ?? null;
  };
}

/** Past the last code point, so `left * CODE_POINT_LIMIT + right` names one pair, well inside 2^53. */
const CODE_POINT_LIMIT = 0x110000;

/** `kerningOf` for characters, with the answer for each pair kept by its pair of code points. */
function keptPairs(
  glyphIndex: (codePoint: number) => number,
  kerningOf: PairKerningReader
): CharacterKerning {
  const kept = new Map<number, number | null>();
  return (leftCodePoint, rightCodePoint) => {
    const pair = leftCodePoint * CODE_POINT_LIMIT + rightCodePoint;
    const known = kept.get(pair);
    if (known !== undefined) return known;
    const left = { glyph: glyphIndex(leftCodePoint), codePoint: leftCodePoint };
    const right = { glyph: glyphIndex(rightCodePoint), codePoint: rightCodePoint };
    const units =
      left.glyph === 0 || right.glyph === 0 ? null : orOnRangeError(() => kerningOf(left, right), 0);
    kept.set(pair, units);
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
  const kept = perObject((_opentype: OpentypeCoordinates) =>
    recentlyRead<number, Map<number, number | null>>(MAX_KEPT_SIZES)
  );

  return (glyphIndex, fontSizePx, opentype) => {
    const byGlyph = kept(opentype)(fontSizePx, newAdvancesByGlyph);
    if (byGlyph.has(glyphIndex)) return byGlyph.get(glyphIndex)!;
    const instance = fontInstanceOf(sfnt, opentype);
    readers ??= instanceAdvanceReaders(sfnt);
    const advance = instance && orOnRangeError(() => readers!(instance, glyphIndex, fontSizePx), null);
    byGlyph.set(glyphIndex, advance);
    return advance;
  };
}

/** Declared once, not inline: an arrow inside the reader would allocate a closure on every read. */
const newAdvancesByGlyph = (): Map<number, number | null> => new Map();

/** A font size animation passes through many sizes, so the advances of this many sizes of one instance are kept. */
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
  kerningReader: InstanceKerningReader | null
): SfntOutlines | null {
  const cmap = sfnt.tables.get('cmap');
  if (!cmap || !outlineOf) return null;
  const lookup = orOnRangeError(() => cmapLookup(sfnt.dv, cmap.offset), null);
  if (!lookup) return null;

  const glyphIndex = (codePoint: number): number => orOnRangeError(() => lookup(codePoint), 0);
  return {
    glyphIndex,
    advanceAtInstance: instanceAdvanceReader(sfnt),
    glyphContours: (glyph, fontSizePx, variation) =>
      orOnRangeError(() => {
        const outline = outlineOf(glyph, fontSizePx, instanceOf(sfnt, variation));
        return outline && variedContours(outline, fontSizePx, variation);
      }, null),
    kerningAtInstance: instanceKerningOf(sfnt, glyphIndex, kerningReader),
    drawsInstance: (opentype) => orOnRangeError(() => fontInstanceOf(sfnt, opentype) !== null, false),
  };
}
