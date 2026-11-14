/**
 * The strikes a face draws its glyphs from. Godot selects a strike only for a face with FreeType's
 * colour flag (`text_server_adv.cpp:1486`), which `CBLC`, `sbix`, `COLR` and `SVG ` set
 * (`sfobjs.c:1097-1101`). Every glyph of the face then loads at the strike's ppem, its bitmap where
 * the strike has one, and draws at the strike's scale.
 */
import { perObject } from '../../../../../utils/perObject';
import { recentlyRead } from '../../../../../utils/recentlyRead';
import { orOnRangeError } from '../sfntCmap';
import { contourBoxReader } from '../sfntGlyf';
import { isScalableFace, parseSfntScalars, readGlyphCount, type SfntFile } from '../sfntTables';
import { readLocatorGlyph } from './locatorGlyph';
import type { ZlibInflate } from './png';
import { readSbitTables, type SbitStrike, type SbitTables } from './sbitStrikes';
import { readSbixGlyph } from './sbixGlyph';
import type { StrikeBitmap } from './strikeBitmap';
import { strikeSizeAt, type ScalableExtent, type StrikeSize } from './strikeSize';

export interface FaceStrikes {
  /** The strike Godot picks for `fontSizePx`, and the FreeType size it gives the face. */
  sizeAt(fontSizePx: number): StrikeSize;
  /**
   * The bitmap of `glyph` in `strike`, or null where it has none: a scalable face then draws the
   * glyph's outline at the strike's ppem, and a face of bitmaps alone draws nothing
   * (`ttgload.c:2401-2460`).
   */
  bitmapOf(strike: SbitStrike, glyph: number): StrikeBitmap | null;
  /** Whether the face has outlines, so a glyph the strike lacks draws its outline. */
  readonly isScalable: boolean;
}

/** A font size animation passes through many sizes, so the strike picks of this many sizes are kept. */
const MAX_KEPT_SIZES = 8;

/** A colour strike's bitmap can be 136 px square, so the bitmaps of this many glyphs a strike are kept. */
const MAX_KEPT_BITMAPS = 256;

/**
 * The strikes of `sfnt`, or null for a face that draws none: one with no strike, or with grey strikes
 * alone and no other colour table. `hasColourTable` tells whether its `COLR` or `SVG ` loads.
 */
export async function faceStrikesOf(sfnt: SfntFile, hasColourTable: boolean): Promise<FaceStrikes | null> {
  const tables = orOnRangeError(() => readSbitTables(sfnt), null);
  if (!tables || !(hasColourTable || tables.kind !== 'EBLC')) return null;
  const { unzlibSync } = await import('three/addons/libs/fflate.module.js');
  const inflate: ZlibInflate = (stream) => unzlibSync(stream);
  const isScalable = isScalableFace(sfnt);
  const extent = isScalable ? scalableExtentOf(sfnt) : null;
  const readGlyph = glyphReaderOf(sfnt, tables, inflate);
  const bitmaps = perObject((_strike: SbitStrike) =>
    recentlyRead<number, StrikeBitmap | null>(MAX_KEPT_BITMAPS)
  );
  // Layout and paint ask for the size of each glyph and pair, so each size's pick is kept.
  const sizes = recentlyRead<number, StrikeSize>(MAX_KEPT_SIZES);
  return {
    sizeAt: (fontSizePx) => sizes(fontSizePx, () => strikeSizeAt(tables.strikes, fontSizePx, extent)),
    bitmapOf: (strike, glyph) => bitmaps(strike)(glyph, () => readGlyph(strike, glyph)),
    isScalable,
  };
}

/** The face's ascender and descender in design units, which `FT_Select_Metrics` scales to a strike. */
function scalableExtentOf(sfnt: SfntFile): ScalableExtent | null {
  const scalars = parseSfntScalars(sfnt);
  return scalars && { unitsPerEm: scalars.unitsPerEm, ascender: scalars.ascent, descender: -scalars.descent };
}

function glyphReaderOf(
  sfnt: SfntFile,
  tables: SbitTables,
  inflate: ZlibInflate
): (strike: SbitStrike, glyph: number) => StrikeBitmap | null {
  if (tables.kind !== 'sbix') return (strike, glyph) => readLocatorGlyph(tables, strike, glyph, inflate);
  const boxOf = contourBoxReader(sfnt);
  const source = {
    glyphCount: readGlyphCount(sfnt) ?? 0,
    inflate,
    contourBoxOf: (glyph: number) => (boxOf ? orOnRangeError(() => boxOf(glyph), null) : null),
  };
  return (strike, glyph) => readSbixGlyph(tables, strike, glyph, source);
}
