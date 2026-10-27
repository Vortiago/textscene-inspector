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

/**
 * The two scratch canvases that cut the outline rings of one paint pass. They grow to the largest
 * glyph and are cleared between glyphs, so a long label allocates two canvases, not two for each glyph.
 */
export class EmboldenRingPainter {
  private readonly ring = document.createElement('canvas');
  private readonly hole = document.createElement('canvas');

  /** `target` is the raster, whose text state (font, alignment, colours, joins) the scratch canvases copy. */
  constructor(private readonly target: CanvasRenderingContext2D) {}

  /**
   * Strokes the outline ring of an emboldened glyph: the annulus `ringWidthPx` wide that FreeType's
   * stroker leaves round the grown contour. A centred canvas stroke reaches `ringWidthPx / 2` each
   * side of the unbolded contour, so the ring is a stroke of `ringWidthPx + growthPx` at the shift,
   * less what lies inside the grown contour's inner edge: the glyph eroded by `(ringWidthPx - growthPx) / 2`,
   * or dilated by the same where the growth is the wider. The ring is cut on a scratch canvas of the
   * glyph's ink, so a neighbour's ring is not cut by this glyph's hole.
   */
  paint(char: string, penX: number, baselineY: number, growthPx: number, ringWidthPx: number): void {
    const ink = this.target.measureText(char);
    const reachPx = Math.ceil((ringWidthPx + growthPx) / 2 + growthPx);
    const originX = Math.floor(penX - ink.actualBoundingBoxLeft - reachPx);
    const originY = Math.floor(baselineY - ink.actualBoundingBoxAscent - reachPx);
    const width = Math.ceil(penX + ink.actualBoundingBoxRight + reachPx) - originX;
    const height = Math.ceil(baselineY + ink.actualBoundingBoxDescent + reachPx) - originY;
    const ring = this.scratch(this.ring, width, height);
    const hole = this.scratch(this.hole, width, height);
    if (!ring || !hole) return;

    const x = penX - originX + growthPx / 2;
    const y = baselineY - originY - growthPx / 2;
    ring.lineWidth = ringWidthPx + growthPx;
    ring.strokeText(char, x, y);

    hole.fillText(char, x, y);
    const erosionPx = ringWidthPx - growthPx;
    if (erosionPx !== 0) {
      hole.lineWidth = Math.abs(erosionPx);
      hole.globalCompositeOperation = erosionPx > 0 ? 'destination-out' : 'source-over';
      hole.strokeText(char, x, y);
    }
    ring.globalCompositeOperation = 'destination-out';
    ring.drawImage(hole.canvas, 0, 0);
    ring.globalCompositeOperation = 'source-over';
    this.target.drawImage(ring.canvas, 0, 0, width, height, originX, originY, width, height);
  }

  /** The cleared 2D context of `canvas`, at least `width` by `height`, drawing text as the raster does. Null with no 2D context. */
  private scratch(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
    // A resize clears the canvas and resets its context.
    if (canvas.width < width) canvas.width = width;
    if (canvas.height < height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const like = this.target;
    ctx.font = like.font;
    ctx.textAlign = like.textAlign;
    ctx.textBaseline = like.textBaseline;
    ctx.fillStyle = like.fillStyle;
    ctx.strokeStyle = like.strokeStyle;
    ctx.lineJoin = like.lineJoin;
    ctx.lineCap = like.lineCap;
    return ctx;
  }
}
