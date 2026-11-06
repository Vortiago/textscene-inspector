/**
 * The unhinted contours of a font's glyphs, which a canvas face fills for a glyph that a `GSUB`
 * lookup gave: no character names it, so `fillText` cannot draw it.
 */

import { variedContours } from './glyphVariation';
import type { GlyphContours, GlyphOutlineReader } from './glyphContours';
import { orOnRangeError } from './sfntCmap';
import { cffOutlineReader } from './sfntCff';
import { glyphOutlineReader } from './sfntGlyf';
import type { SfntFile } from './sfntTables';

/**
 * The contours of each glyph at a font size, or null for a glyph with no outline. `openOutlines`
 * opens the font with its `glyf` or `CFF ` table at the first glyph asked, so text with no
 * substituted glyph reads no outline. Unhinted, as the browser draws the text around it.
 */
export function unhintedContoursReader(
  openOutlines: () => SfntFile | null
): (glyphIndex: number, fontSizePx: number) => GlyphContours | null {
  let outlineOf: GlyphOutlineReader | null | undefined;
  const readOutline = () => {
    if (outlineOf !== undefined) return outlineOf;
    const sfnt = openOutlines();
    return (outlineOf = sfnt && (glyphOutlineReader(sfnt, null) ?? cffOutlineReader(sfnt)));
  };
  return (glyphIndex, fontSizePx) => {
    const read = readOutline();
    const outline = read && orOnRangeError(() => read(glyphIndex, fontSizePx), null);
    return outline && variedContours(outline, fontSizePx);
  };
}
