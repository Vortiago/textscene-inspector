/**
 * The bitmap of a glyph in an `sbix` strike, as FreeType's `tt_face_load_sbix_image` reads it
 * (`ttsbit.c:1445-1624`): a PNG, a `dupe` of another glyph's image, or a `flip` of one mirrored left
 * to right. FreeType fails JPEG, TIFF and every other graphic type.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import { bytesView } from '../../../../../utils/bytesView';
import { ftMulFix } from '../fontMetrics';
import { orOnRangeError } from '../sfntCmap';
import { decodePng, type ZlibInflate } from './png';
import type { SbitStrike, SbitTables } from './sbitStrikes';
import type { StrikeBitmap } from './strikeBitmap';

/** The glyph's `glyf` box as the bitmap's origin needs it: its `hmtx` bearing and its lowest point, design units. */
export interface ContourBox {
  readonly leftBearing: number;
  readonly yMin: number;
}

export interface SbixGlyphSource {
  /** `maxp.numGlyphs`: FreeType reads no glyph past it. */
  readonly glyphCount: number;
  readonly inflate: ZlibInflate;
  /** The box of a glyph with at least one contour in `glyf`, else null. */
  readonly contourBoxOf: (glyph: number) => ContourBox | null;
}

/** FreeType follows at most this many `dupe` and `flip` records (`ttsbit.c:1518`). */
const MAX_REFERENCES = 4;

/**
 * The bitmap of `glyph` in `strike`, or null where FreeType's load fails. A glyph with a contour has
 * its bitmap's origin at the corner of the contour's box (`ttgload.c:2419-2443`).
 */
export function readSbixGlyph(
  tables: SbitTables,
  strike: SbitStrike,
  glyph: number,
  source: SbixGlyphSource
): StrikeBitmap | null {
  const image = orOnRangeError(() => sbixImage(tables, strike, glyph, source), null);
  if (!image) return null;
  const box = source.contourBoxOf(glyph);
  if (!box) return image;
  const { xScale, yScale } = strike.metrics;
  return {
    ...image,
    left: image.left + (ftMulFix(box.leftBearing, xScale) >> 6),
    top: image.top + (ftMulFix(box.yMin, yScale) >> 6),
  };
}

function sbixImage(
  { data: sbix }: SbitTables,
  { tableIndex }: SbitStrike,
  glyph: number,
  { glyphCount, inflate }: SbixGlyphSource
): StrikeBitmap | null {
  const view = bytesView(sbix);
  const strikeOffset = view.getUint32(8 + 4 * tableIndex);
  let isFlipped = false;
  for (let references = 0; ; references++) {
    if (glyph > glyphCount) return null;
    if (strikeOffset >= sbix.length || sbix.length - strikeOffset < 4 + glyph * 4 + 8) return null;
    const start = view.getUint32(strikeOffset + 4 + glyph * 4);
    const end = view.getUint32(strikeOffset + 8 + glyph * 4);
    if (start === end || start > end || end - start < 8 || sbix.length - strikeOffset < end) return null;
    const at = strikeOffset + start;
    const originX = view.getInt16(at);
    const originY = view.getInt16(at + 2);
    const graphicType = String.fromCharCode(...sbix.subarray(at + 4, at + 8));
    if (graphicType === 'flip' || graphicType === 'dupe') {
      if (references >= MAX_REFERENCES) return null;
      if (graphicType === 'flip') isFlipped = !isFlipped;
      glyph = view.getUint16(at + 8);
      continue;
    }
    if (graphicType !== 'png ') return null;
    const png = decodePng(sbix.subarray(at + 8, strikeOffset + end), inflate);
    if (!png) return null;
    return {
      pixelMode: 'bgra',
      width: png.width,
      rows: png.height,
      pitch: png.width * 4,
      buffer: isFlipped ? mirrored(png.bgra, png.width) : png.bgra,
      left: originX,
      top: originY + png.height,
    };
  }
}

/** Each row of a BGRA image reversed, pixel by pixel (`ttsbit.c:1546-1569`). */
function mirrored(bgra: Uint8Array, width: number): Uint8Array {
  const pixels = new Uint32Array(bgra.slice().buffer);
  for (let row = 0; row < pixels.length; row += width) pixels.subarray(row, row + width).reverse();
  return new Uint8Array(pixels.buffer);
}
