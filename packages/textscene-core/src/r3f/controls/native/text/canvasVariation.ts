/**
 * The font-variation half of `canvasTextPainter.ts`: the embolden padding, the contours of an
 * emboldened or sheared glyph, and the emboldened text of a glyph with no contour. Godot emboldens the
 * contour (`text_server_adv.cpp:1314`), shears it (`:1318`), then strokes the result (`:1383`).
 */
import { variationKey, type GlyphVariation } from './fontMetrics';
import type { GlyphContours } from './glyphContours';
import type { SfntOutlines } from './sfntOutlines';
import type { TextLayoutResult } from './textLayout';
import { recentlyRead } from '../../../../utils/recentlyRead';
import { perObject } from '../../../../utils/perObject';

/** The largest outline growth over the glyphs of `layout`, px. 0 for a layout with no embolden. */
export function maxEmboldenGrowthPx(layout: TextLayoutResult): number {
  let growthPx = 0;
  for (const line of layout.lines) {
    for (const gp of line.glyphs) growthPx = Math.max(growthPx, gp.emboldenGrowthPx ?? 0);
  }
  return growthPx;
}

/**
 * Fills the glyph, then strokes it with a centred line of the growth's width, drawn at the
 * shift. Both cover the same ink as the emboldened outline. FreeType mitres the corners, as the
 * `miter` join does, so the caller sets it. It serves a font with no outline to read: `fillText`
 * snaps its baseline to a whole pixel, so the fill can sit up to half a pixel off its own stroke.
 */
export function paintEmboldenedFill(
  ctx: CanvasRenderingContext2D,
  char: string,
  penX: number,
  baselineY: number,
  growthPx: number
): void {
  const x = penX + growthPx / 2;
  const y = baselineY - growthPx / 2;
  ctx.fillText(char, x, y);
  ctx.lineWidth = growthPx;
  ctx.strokeText(char, x, y);
}

/** A font size animation adds a face for each size it passes, so the least recently read face goes at this count. */
const MAX_CACHED_FACES = 8;

/**
 * The contours read so far, by font, then by size and variation, then by glyph. A repaint at a new
 * tint, such as a modulate animation, reads none again.
 */
const readContours = perObject((_outlines: SfntOutlines) =>
  recentlyRead<string, Map<number, GlyphContours | null>>(MAX_CACHED_FACES)
);

/**
 * Reads the outline of a glyph as the font variation leaves it at `fontSizePx`: null for glyph 0 and
 * a glyph with no outline. The face's cache is found once, so a glyph costs one lookup.
 */
export function variedGlyphContoursReader(
  outlines: SfntOutlines,
  fontSizePx: number,
  variation: GlyphVariation
): (glyphIndex: number) => GlyphContours | null {
  const read = readContours(outlines)(`${fontSizePx}/${variationKey(variation)}`, () => new Map());
  return (glyphIndex) => {
    if (glyphIndex === 0) return null;
    let contours = read.get(glyphIndex);
    if (contours === undefined)
      read.set(glyphIndex, (contours = outlines.glyphContours(glyphIndex, fontSizePx, variation)));
    return contours;
  };
}

/** `contoursOfGlyph`, a {@link variedGlyphContoursReader}, for the `cmap` glyph of a character at the variation's instance. */
export function glyphContoursReader(
  outlines: SfntOutlines,
  contoursOfGlyph: (glyphIndex: number) => GlyphContours | null,
  opentype: GlyphVariation['opentype']
): (char: string) => GlyphContours | null {
  const byChar = new Map<string, GlyphContours | null>();
  return (char) => {
    let contours = byChar.get(char);
    if (contours === undefined)
      byChar.set(char, (contours = contoursOfGlyph(outlines.glyphIndex(char.codePointAt(0)!, opentype))));
    return contours;
  };
}

/** Shears what the context draws next about `baselineY`: x' = x - skew * (y - baselineY). */
export function shearAboutBaseline(ctx: CanvasRenderingContext2D, skew: number, baselineY: number): void {
  ctx.transform(1, 0, -skew, 1, skew * baselineY, 0);
}
