/**
 * A font's glyph outlines as Godot's text server hands them to TextMesh: the glyph index of a
 * character from `cmap` (`sfntCmap.ts`), and the points of that glyph from `glyf` (`sfntGlyf.ts`) or
 * from `CFF ` and `CFF2` (`sfntCff.ts`). A WOFF or WOFF2 opens through `fontContainer.ts`, which
 * hands the readers the plain tables.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { cmapLookup } from './sfntCmap';
import type { GlyphContours } from './glyphContours';
import type { GlyphVariation } from './fontMetrics';
import { cffContourReader } from './sfntCff';
import { glyphContourReader } from './sfntGlyf';
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
 * puts past the buffer.
 */
export async function openFontOutlines(bytes: ArrayBuffer): Promise<SfntOutlines | null> {
  const sfnt = await openFontContainer(bytes, OUTLINE_TABLE_TAGS);
  return sfnt && readSfntOutlines(sfnt);
}

function readSfntOutlines(sfnt: SfntFile): SfntOutlines | null {
  const cmap = sfnt.tables.get('cmap');
  const contours = glyphContourReader(sfnt) ?? cffContourReader(sfnt);
  if (!cmap || !contours) return null;
  const lookup = orOnRangeError(() => cmapLookup(sfnt.dv, cmap.offset), null);
  if (!lookup) return null;

  return {
    glyphIndex: (codePoint) => orOnRangeError(() => lookup(codePoint), 0),
    glyphContours: (glyphIndex, fontSizePx, variation) =>
      orOnRangeError(() => contours(glyphIndex, fontSizePx, variation), null),
  };
}
