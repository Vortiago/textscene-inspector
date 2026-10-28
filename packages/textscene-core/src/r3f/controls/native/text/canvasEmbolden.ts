/**
 * The embolden half of `canvasTextPainter.ts`: how far an embolden pads the raster, how an
 * emboldened fill is drawn with canvas-2D calls, and how the outline ring of an emboldened or
 * sheared glyph is stroked. `FT_Outline_Embolden`
 * grows the contour and shifts it right and up by half the growth (`text_server_adv.cpp:1314-1315`);
 * `FT_Outline_Transform` then shears it (`:1318-1320`), and the stroker strokes the result
 * (`:1383-1390`).
 */
import type { GlyphVariation } from './fontMetrics';
import type { GlyphContours } from './glyphContours';
import { traceGlyphContours } from './glyphPath';
import type { SfntOutlines } from './sfntOutlines';
import type { TextLayoutResult } from './textLayout';

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
 * `miter` join does, so the caller sets it.
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

/** The outline of `char` as the font variation leaves it, or null for a glyph the font has no outline for. */
export function variedGlyphContours(
  outlines: SfntOutlines,
  char: string,
  fontSizePx: number,
  variation: GlyphVariation
): GlyphContours | null {
  const glyphIndex = outlines.glyphIndex(char.codePointAt(0)!);
  return glyphIndex === 0 ? null : outlines.glyphContours(glyphIndex, fontSizePx, variation);
}

/**
 * Strokes `contours` from the pen, with the stroke state of `ctx`. The contours carry their own
 * shear, so the line draws under the identity transform and keeps its width in every direction.
 */
export function strokeContours(
  ctx: CanvasRenderingContext2D,
  contours: GlyphContours,
  penX: number,
  baselineY: number
): void {
  ctx.save();
  ctx.resetTransform();
  ctx.beginPath();
  traceGlyphContours(ctx, contours, penX, baselineY);
  ctx.stroke();
  ctx.restore();
}
