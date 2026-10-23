/**
 * The embolden half of `canvasTextPainter.ts`: how far an embolden pads the raster, and how an
 * emboldened glyph's fill is drawn with canvas-2D calls. `FT_Outline_Embolden`
 * offsets the contour by half the growth on every side, then shifts it right and up by half, so
 * the left and bottom edges stay (`text_server_adv.cpp:1313-1314`).
 */
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
