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

import { Hinting, type FontHinting } from '../../../../godot/text/textServerEnums';
import { orOnRangeError, sfntGlyphIndex } from './sfntCmap';
import { glyphMetricsReader, metricsAtInstance } from './sfntGlyphMetrics';
import type { GlyphContours, GlyphOutlineReader } from './glyphContours';
import {
  glyphAdvance26_6,
  isInstanced,
  type GlyphVariation,
  type OpentypeCoordinates,
  type PairKerning,
} from './fontMetrics';
import { cffOutlineReader, unhintedCffOutlineReader } from './sfntCff';
import { isNativelyHinted, type GlyphHinting } from './glyphHinting';
import { glyfAdvanceReader, glyphOutlineReader } from './sfntGlyf';
import { variedContours } from './glyphVariation';
import { isTrickyFont } from './trickyFont';
import { openFontContainer } from './fontContainer';
import {
  hasFreeTypeOutlines,
  isScalableFace,
  OUTLINE_TABLE_TAGS,
  readHeadUnitsPerEm,
  type SfntFile,
} from './sfntTables';
import { fontInstanceOf, type FontInstance } from './variation/fontInstance';
import type { RunCluster } from './glyphRun';
import type { LookupGlyph } from './autofit/openTypeGdef';
import type { instanceGlyphIndex, InstanceGlyphIndex, instanceRunShaping } from './variation/instanceGlyph';
import type { instanceKerningReader, PairKerningReader } from './variation/instanceKerning';
import { keptPairs } from './keptPairs';
import { perObject } from '../../../../utils/perObject';
import { recentlyRead } from '../../../../utils/recentlyRead';
import { readCpal } from './colour/cpal';
import { colrLayersReader, type ColrLayersReader } from './colour/colr';
import { faceStrikesOf, type FaceStrikes } from './strike/faceStrikes';
import { svgGlyphsOf, type SvgGlyphs } from './svg/svgGlyphs';
import { readSvgTable } from './svg/svgTable';

type InstanceKerningReader = typeof instanceKerningReader;
/** The readers of the glyphs at an instance, which load with a font that has `GSUB` and `fvar`. */
interface InstanceGlyphReaders {
  instanceGlyphIndex: typeof instanceGlyphIndex;
  instanceRunShaping: typeof instanceRunShaping;
}

export interface SfntOutlines {
  /**
   * The glyph index of `codePoint` as HarfBuzz's `rvrn` feature leaves it at the axis values of
   * `opentype`, or at the default instance without them: the glyph `cmap` gives it, or 0 for a
   * character the font lacks.
   */
  glyphIndex(codePoint: number, opentype?: OpentypeCoordinates): number;
  /** The contours of a glyph at `fontSizePx`, changed by `variation`, or null for a glyph with no outline. */
  glyphContours(glyphIndex: number, fontSizePx: number, variation?: GlyphVariation): GlyphContours | null;
  /**
   * The advance in 26.6 of a glyph at `fontSizePx`, as HarfBuzz shapes it at the axis values of
   * `opentype`: null when the glyph stays at the default instance's advance. Absent for outlines of
   * a font with no variation axes to set, such as a BMFont's.
   */
  advanceAtInstance?(glyphIndex: number, fontSizePx: number, opentype: OpentypeCoordinates): number | null;
  /**
   * The `GPOS` kerning of a pair of glyphs, as HarfBuzz shapes it at the axis values of `opentype`:
   * null where they draw the default instance, where the font has no `kern` feature to read, and for
   * glyph 0. Absent for outlines with no `GPOS` variation to read.
   */
  kerningAtInstance?(
    left: LookupGlyph,
    right: LookupGlyph,
    opentype: OpentypeCoordinates
  ): PairKerning | null;
  /** Whether the axis values of `opentype` draw an instance other than the default. */
  drawsInstance?(opentype: OpentypeCoordinates): boolean;
  /**
   * `FontMetrics.shaping` at the axis values of `opentype`, under the lookups of the `GSUB`
   * `FeatureVariations` record that holds there: null where they draw the default instance. Absent
   * for outlines with no `GSUB` variation to read.
   */
  shapingAt?(chars: readonly string[], opentype: OpentypeCoordinates): readonly RunCluster[] | null;
  /**
   * The `COLR` layers of a glyph in the default palette (`colour/colr.ts`). Absent for a font with
   * no `COLR` and `CPAL` that FreeType reads.
   */
  readonly colourLayers?: ColrLayersReader;
  /**
   * The bitmap strikes a face with colour glyphs draws from (`strike/faceStrikes.ts`). Absent for a
   * face that draws none.
   */
  readonly strikes?: FaceStrikes;
  /** The `SVG ` glyphs of the face (`svg/svgGlyphs.ts`). Absent for a face with no `SVG ` FreeType reads. */
  readonly svgGlyphs?: SvgGlyphs;
  /**
   * Whether a glyph loads its SVG form before its strike bitmap, as the auto-hinter's load does
   * (`ftobjs.c:1019-1050`). The driver's own load takes the strike first (`ttgload.c:2385-2490`).
   */
  readonly loadsSvgBeforeStrike?: boolean;
  /** `FontFile.modulate_color_glyphs` of the load: the font colour tints a colour glyph. */
  readonly modulatesColourGlyphs?: boolean;
}

/**
 * How a font's glyphs load: its `hinting` (`text_server_adv.cpp:1270-1282`) and `force_autohinter`,
 * and how its colour glyphs draw: `modulate_color_glyphs`.
 */
export interface GlyphLoad {
  hinting: FontHinting;
  isAutohinterForced: boolean;
  /** Whether the font colour tints a colour glyph, which Godot leaves untinted by default (`text_server_adv.cpp:4044`). */
  modulatesColourGlyphs?: boolean;
}

/** The load of `font_get_glyph_contours`, which a TextMesh extrudes: the normal target (`text_server_adv.cpp:3613`). */
export const CONTOUR_LOAD: GlyphLoad = { hinting: Hinting.NORMAL, isAutohinterForced: false };

/**
 * Reads the outlines of a TrueType or OpenType-CFF font in a plain, WOFF or WOFF2 file, or returns
 * `null`, never throws, for a font with no `glyf` or CFF table and no strike it draws, no readable
 * `cmap` or a table that does not fit its buffer. The reader answers no glyph, not an error, for an offset a corrupt table
 * puts past the buffer. Each glyph loads as `load` asks.
 */
export async function openFontOutlines(
  bytes: ArrayBuffer,
  load: GlyphLoad = CONTOUR_LOAD
): Promise<SfntOutlines | null> {
  const sfnt = await openFontContainer(bytes, OUTLINE_TABLE_TAGS);
  if (!sfnt) return null;
  const colourLayers = colourLayersOf(sfnt);
  const [outlineOf, strikes, svgGlyphs, kerningReader, glyphReaders] = await Promise.all([
    outlineReaderOf(sfnt, load),
    faceStrikesOf(sfnt, colourLayers !== undefined || readSvgTable(sfnt) !== null),
    svgGlyphsOf(sfnt),
    variationReaderOf(
      sfnt,
      ['GPOS', 'fvar'],
      async () => (await import('./variation/instanceKerning')).instanceKerningReader
    ),
    variationReaderOf(sfnt, ['GSUB', 'fvar'], () => import('./variation/instanceGlyph')),
  ]);
  const glyphOutlineOf = drawnOutlineReader(sfnt, outlineOf, strikes !== null || svgGlyphs !== null);
  const outlines = readSfntOutlines(sfnt, glyphOutlineOf, kerningReader, glyphReaders);
  return (
    outlines && {
      ...outlines,
      ...(colourLayers && { colourLayers }),
      ...(strikes && { strikes }),
      ...(svgGlyphs && { svgGlyphs }),
      ...(svgGlyphs && strikes && isAutoHinted(sfnt, load) && { loadsSvgBeforeStrike: true }),
      ...(load.modulatesColourGlyphs && { modulatesColourGlyphs: true }),
    }
  );
}

/**
 * The outline reader of a face, or null for a face that draws nothing. A face of strikes or SVG
 * documents alone has no outline, and draws each glyph from those.
 */
function drawnOutlineReader(
  sfnt: SfntFile,
  outlineOf: GlyphOutlineReader | null,
  drawsWithoutOutlines: boolean
): GlyphOutlineReader | null {
  if (hasFreeTypeOutlines(sfnt) && outlineOf) return outlineOf;
  return drawsWithoutOutlines ? NO_OUTLINE : null;
}

/**
 * The reader `FT_Load_Glyph` picks for `load` (`ftobjs.c:976-1016`): a tricky font hints itself,
 * even with no hinting asked (`ttdriver.c`, `tt_glyph_load`). Otherwise no hinting reads the outline
 * as it is, and the auto-hinter takes a forced load, a TrueType font at the light target, since its
 * driver does not hint lightly, and a TrueType font without hints.
 */
async function outlineReaderOf(sfnt: SfntFile, load: GlyphLoad): Promise<GlyphOutlineReader | null> {
  if (isTrickyFont(sfnt)) return nativeReaderOf(sfnt);
  if (load.hinting === Hinting.NONE) return unhintedReaderOf(sfnt);
  return isAutoHinted(sfnt, load) ? autoHintedReaderOf(sfnt, load.hinting) : nativeReaderOf(sfnt);
}

/** Whether `FT_Load_Glyph` takes the auto-hinter's load for `load` (`ftobjs.c:976-1016`). */
function isAutoHinted(sfnt: SfntFile, load: GlyphLoad): boolean {
  if (!isScalableFace(sfnt) || isTrickyFont(sfnt) || load.hinting === Hinting.NONE) return false;
  const isTrueType = sfnt.tables.has('glyf');
  return (
    load.isAutohinterForced || (isTrueType && (load.hinting === Hinting.LIGHT || !isNativelyHinted(sfnt)))
  );
}

/** The reader of a font's outlines scaled with no hints, as `FT_LOAD_NO_HINTING` loads them. */
function unhintedReaderOf(sfnt: SfntFile): GlyphOutlineReader | null {
  return glyphOutlineReader(sfnt, null) ?? unhintedCffOutlineReader(sfnt);
}

/**
 * The reader of a variable font that `load` imports, or null for a font without all of `tables`. The
 * module loads with the font, and the reader reads the tables when an instance first asks.
 */
async function variationReaderOf<Reader>(
  sfnt: SfntFile,
  tables: readonly string[],
  load: () => Promise<Reader>
): Promise<Reader | null> {
  if (!tables.every((tag) => sfnt.tables.has(tag))) return null;
  try {
    return await load();
  } catch {
    // A reader only refines the glyphs and advances: a chunk that fails to load (offline, after a deploy) must not take the outlines with it.
    return null;
  }
}

/**
 * The kerning of each pair at an instance, kept for each instance as a layout asks for the same pair
 * again and again. A font at its default instance reads no table. A pair that a corrupt table puts
 * past the buffer kerns 0.
 */
function instanceKerningOf(
  sfnt: SfntFile,
  instanceAt: InstanceReader,
  kerningReader: InstanceKerningReader | null
): SfntOutlines['kerningAtInstance'] {
  if (!kerningReader) return undefined;
  // Read when an instance first asks. Null is a font with no pair kerning, read only once.
  let kerningAtOf: ReturnType<InstanceKerningReader> | undefined;
  // `??=` would read again for the null of a font without pair kerning.
  const kerningAt = () =>
    kerningAtOf === undefined ? (kerningAtOf = orOnRangeError(() => kerningReader(sfnt), null)) : kerningAtOf;
  // Kept with its instance, and so for as long as the layout's opentype wrapper that asks for it lives.
  const pairsAt = perObject((instance: FontInstance): PairKerningReader | null => {
    const kerningAtInstance = kerningAt();
    return kerningAtInstance && keptPairs(kerningAtInstance(instance.normalized));
  });
  return (left, right, opentype) => {
    if (left.glyph === 0 || right.glyph === 0) return null;
    const instance = instanceAt(opentype);
    return (instance && pairsAt(instance)?.(left, right)) ?? null;
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

/**
 * The auto-hinter's reader for the target `hinting`, which hints a variable font at the instance that
 * its glyphs and blue zones follow.
 */
async function autoHintedReaderOf(sfnt: SfntFile, hinting: FontHinting): Promise<GlyphOutlineReader | null> {
  const { autoHintedReader } = await import('./autofit/autoHinter');
  return orOnRangeError(() => autoHintedReader(sfnt, hinting === Hinting.LIGHT ? 'light' : 'normal'), null);
}

/** The font at the axis values of `variation`, or null for the default instance. */
function instanceOf(instanceAt: InstanceReader, variation: GlyphVariation | undefined): FontInstance | null {
  return isInstanced(variation?.opentype) ? instanceAt(variation.opentype) : null;
}

/** The font at axis values, or null for the default instance and for variation tables past the bytes. */
type InstanceReader = (opentype: OpentypeCoordinates) => FontInstance | null;

/**
 * `fontInstanceOf` that answers null where the variation tables run past the bytes. `fontInstanceOf`
 * keeps no throw, so the null is kept here with its axis values, and a corrupt font parses once
 * for each. Equal axis values share one instance, and so the pairs kept for it.
 */
function instanceReaderOf(sfnt: SfntFile): InstanceReader {
  return perObject((opentype: OpentypeCoordinates) =>
    orOnRangeError(() => fontInstanceOf(sfnt, opentype), null)
  );
}

/**
 * The advance in 26.6 of each glyph of `sfnt` at an instance. FreeType takes it from `hmtx` and
 * `HVAR` where the font has `HVAR` (`tt_get_advances`), and else from the phantom points of an
 * unhinted load. The readers are built once per font and each answer is kept, as a layout asks
 * for the same glyph at the same size again and again.
 */
function instanceAdvanceReader(
  sfnt: SfntFile,
  instanceAt: InstanceReader
): SfntOutlines['advanceAtInstance'] {
  let readers: ReturnType<typeof instanceAdvanceReaders> | undefined;
  const kept = perObject((_opentype: OpentypeCoordinates) =>
    recentlyRead<number, Map<number, number | null>>(MAX_KEPT_SIZES)
  );

  return (glyphIndex, fontSizePx, opentype) => {
    const byGlyph = kept(opentype)(fontSizePx, newAdvancesByGlyph);
    if (byGlyph.has(glyphIndex)) return byGlyph.get(glyphIndex)!;
    const instance = instanceAt(opentype);
    const advance =
      instance &&
      orOnRangeError(
        () => (readers ??= instanceAdvanceReaders(sfnt))(instance, glyphIndex, fontSizePx),
        null
      );
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
  kerningReader: InstanceKerningReader | null,
  glyphReaders: InstanceGlyphReaders | null
): SfntOutlines | null {
  const cmapGlyphIndex = outlineOf && sfntGlyphIndex(sfnt);
  if (!cmapGlyphIndex) return null;

  const instanceAt = instanceReaderOf(sfnt);
  const glyphIndex: InstanceGlyphIndex = glyphReaders
    ? glyphReaders.instanceGlyphIndex(sfnt, cmapGlyphIndex)
    : cmapGlyphIndex;
  const shapingOf = glyphReaders?.instanceRunShaping(sfnt) ?? undefined;
  return {
    glyphIndex: (codePoint, opentype) => glyphIndex(codePoint, opentype ? instanceAt(opentype) : null),
    advanceAtInstance: instanceAdvanceReader(sfnt, instanceAt),
    glyphContours: (glyph, fontSizePx, variation) =>
      orOnRangeError(() => {
        const outline = outlineOf(glyph, fontSizePx, instanceOf(instanceAt, variation));
        return outline && variedContours(outline, fontSizePx, variation);
      }, null),
    kerningAtInstance: instanceKerningOf(sfnt, instanceAt, kerningReader),
    drawsInstance: (opentype) => instanceAt(opentype) !== null,
    shapingAt:
      shapingOf &&
      ((chars, opentype) => {
        const instance = instanceAt(opentype);
        return instance && shapingOf(instance)(chars);
      }),
  };
}

/** The outline reader of a face with no outlines: no glyph has one. */
const NO_OUTLINE: GlyphOutlineReader = () => null;

/** The reader of each glyph's `COLR` layers, or undefined for a font with none that FreeType reads. */
function colourLayersOf(sfnt: SfntFile): ColrLayersReader | undefined {
  const palette = orOnRangeError(() => readCpal(sfnt), null);
  const layersOf = palette && orOnRangeError(() => colrLayersReader(sfnt, palette), null);
  return layersOf ? (glyph) => orOnRangeError(() => layersOf(glyph), null) : undefined;
}
