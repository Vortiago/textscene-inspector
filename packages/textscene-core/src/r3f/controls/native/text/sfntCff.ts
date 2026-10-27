/**
 * Reads the outline of a glyph from the `CFF ` or `CFF2` table of an OpenType font, scaled to a
 * font size the way FreeType's Adobe engine scales it for a hinted load, which is how Godot loads
 * it (`text_server_adv.cpp:3606`). The engine hints y, moving stem edges onto the pixel grid, and
 * leaves x where the scale puts it.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { interpretCharstring } from './cffCharstring';
import { applyFontMatrix, rescaledOutlineScale } from './cffFontMatrix';
import type { CharstringContour } from './cffPen';
import { openCff } from './cffTables';
import { getFontOutlineScale } from './fontMetrics';
import { scaledOutlineContours, type GlyphContourReader, type ScaledOutline } from './glyphContours';
import { readHeadUnitsPerEm, type SfntFile } from './sfntTables';

/** The divisor of the arithmetic shift right by 10 that `cff_builder_add_point` makes, from 16.16 to 26.6. */
const FIXED_16_16_TO_26_6 = 1024;

/**
 * The factor the Adobe engine multiplies a 16.16 charstring coordinate by (`cf2_getScaleAndHintFlag`):
 * the 26.6 scale of the glyph, divided by 64 with rounding, so the product is a 16.16 px.
 */
function charstringScale(outlineScale: number): number {
  return Math.floor((outlineScale + 32) / 64);
}

/**
 * The contours as FreeType keeps them in a glyph slot. A contour whose last point lands on its
 * first loses that point, and one left with a single point is dropped (`cff_builder_close_contour`).
 */
function scaledOutline(contours: readonly CharstringContour[]): ScaledOutline {
  const outline: ScaledOutline = { x: [], y: [], tags: [], contourEnds: [] };
  for (const contour of contours) {
    const xs = contour.x.map(toFixed26_6);
    const ys = contour.y.map(toFixed26_6);
    const last = xs.length - 1;
    const pointCount = xs[last] === xs[0] && ys[last] === ys[0] ? last : last + 1;
    if (pointCount < 2) continue;
    outline.x.push(...xs.slice(0, pointCount));
    outline.y.push(...ys.slice(0, pointCount));
    outline.tags.push(...contour.tags.slice(0, pointCount));
    outline.contourEnds.push(outline.x.length - 1);
  }
  return outline;
}

/** A 16.16 px coordinate in 26.6: the low bits dropped by an arithmetic shift. */
function toFixed26_6(coordinate: number): number {
  return Math.floor(coordinate / FIXED_16_16_TO_26_6);
}

/** The glyph-contour reader of a font's CFF outlines, or null for a font with no readable `CFF ` or `CFF2` table or no `head`. */
export function cffContourReader(sfnt: SfntFile): GlyphContourReader | null {
  const headUnitsPerEm = readHeadUnitsPerEm(sfnt);
  if (headUnitsPerEm === 0) return null;
  const font = openCff(sfnt);
  if (!font) return null;

  return (glyphIndex, fontSizePx) => {
    const matrix = font.matrixOf(glyphIndex);
    if (!matrix) return null;
    const outlineScale = rescaledOutlineScale(
      getFontOutlineScale(headUnitsPerEm, fontSizePx),
      font.unitsPerEm,
      matrix
    );
    const contours = interpretCharstring(font, glyphIndex, charstringScale(outlineScale));
    if (!contours) return null;
    const outline = scaledOutline(contours);
    if (outline.x.length === 0) return null;
    applyFontMatrix(outline, matrix);
    return scaledOutlineContours(outline);
  };
}
