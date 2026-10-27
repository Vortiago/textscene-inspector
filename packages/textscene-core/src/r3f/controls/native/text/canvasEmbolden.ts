/**
 * The embolden half of `canvasTextPainter.ts`: how far an embolden pads the raster, and how an
 * emboldened glyph's fill and outline ring are drawn with canvas-2D calls. `FT_Outline_Embolden`
 * offsets the contour by half the growth on every side, then shifts it right and up by half, so
 * the left and bottom edges stay (`text_server_adv.cpp:1313-1314`). The stroker then strokes that
 * grown contour (`:1376-1403`).
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

/** A scratch canvas of `width` by `height` whose context draws text as `like` does, or null with no 2D context. */
function scratchLike(
  like: CanvasRenderingContext2D,
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = like.font;
  ctx.textAlign = like.textAlign;
  ctx.textBaseline = like.textBaseline;
  ctx.fillStyle = like.fillStyle;
  ctx.strokeStyle = like.strokeStyle;
  ctx.lineJoin = like.lineJoin;
  ctx.lineCap = like.lineCap;
  return { canvas, ctx };
}

/**
 * Strokes the outline ring of an emboldened glyph: the annulus `ringWidthPx` wide that FreeType's
 * stroker leaves round the grown contour. A centred canvas stroke reaches `ringWidthPx / 2` each
 * side of the unbolded contour, so the ring is a stroke of `ringWidthPx + growthPx` at the shift,
 * less what lies inside the grown contour's inner edge: the glyph eroded by `(ringWidthPx - growthPx) / 2`,
 * or dilated by the same where the growth is the wider. The ring is cut on a scratch canvas of the
 * glyph's ink, so a neighbour's ring is not cut by this glyph's hole.
 */
export function paintEmboldenedRing(
  ctx: CanvasRenderingContext2D,
  char: string,
  penX: number,
  baselineY: number,
  growthPx: number,
  ringWidthPx: number
): void {
  const ink = ctx.measureText(char);
  const reachPx = Math.ceil((ringWidthPx + growthPx) / 2 + growthPx);
  const originX = Math.floor(penX - ink.actualBoundingBoxLeft - reachPx);
  const originY = Math.floor(baselineY - ink.actualBoundingBoxAscent - reachPx);
  const width = Math.ceil(penX + ink.actualBoundingBoxRight + reachPx) - originX;
  const height = Math.ceil(baselineY + ink.actualBoundingBoxDescent + reachPx) - originY;
  const ring = scratchLike(ctx, width, height);
  const hole = scratchLike(ctx, width, height);
  if (!ring || !hole) return;

  const x = penX - originX + growthPx / 2;
  const y = baselineY - originY - growthPx / 2;
  ring.ctx.lineWidth = ringWidthPx + growthPx;
  ring.ctx.strokeText(char, x, y);

  hole.ctx.fillText(char, x, y);
  const erosionPx = ringWidthPx - growthPx;
  if (erosionPx !== 0) {
    hole.ctx.lineWidth = Math.abs(erosionPx);
    hole.ctx.globalCompositeOperation = erosionPx > 0 ? 'destination-out' : 'source-over';
    hole.ctx.strokeText(char, x, y);
  }
  ring.ctx.globalCompositeOperation = 'destination-out';
  ring.ctx.drawImage(hole.canvas, 0, 0);
  ring.ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(ring.canvas, originX, originY);
}
