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

/** A box of whole pixels on the raster. */
interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
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
   * Strokes the `ringWidthPx` annulus that FreeType's stroker leaves round the grown contour: a
   * stroke of `ringWidthPx + growthPx` at the shift, less the glyph eroded by `(ringWidthPx - growthPx) / 2`
   * (dilated where the growth is the wider). The cut runs on scratch canvases that share the raster's
   * transform, so a skew stays vector-sharp, and a neighbour's ring keeps its ink.
   */
  paint(char: string, penX: number, baselineY: number, growthPx: number, ringWidthPx: number): void {
    const matrix = this.target.getTransform();
    const reachPx = Math.ceil((ringWidthPx + growthPx) / 2 + growthPx);
    const bounds = this.inkBounds(char, penX, baselineY, reachPx, matrix);
    const ring = this.scratch(this.ring, bounds, matrix);
    const hole = this.scratch(this.hole, bounds, matrix);
    if (!ring || !hole) return;

    const x = penX + growthPx / 2;
    const y = baselineY - growthPx / 2;
    ring.lineWidth = ringWidthPx + growthPx;
    ring.strokeText(char, x, y);

    hole.fillText(char, x, y);
    const erosionPx = ringWidthPx - growthPx;
    if (erosionPx !== 0) {
      hole.lineWidth = Math.abs(erosionPx);
      hole.globalCompositeOperation = erosionPx > 0 ? 'destination-out' : 'source-over';
      hole.strokeText(char, x, y);
    }
    ring.setTransform(1, 0, 0, 1, 0, 0);
    ring.globalCompositeOperation = 'destination-out';
    ring.drawImage(hole.canvas, 0, 0);
    ring.globalCompositeOperation = 'source-over';
    this.target.save();
    this.target.setTransform(1, 0, 0, 1, 0, 0);
    this.target.drawImage(
      ring.canvas,
      0,
      0,
      bounds.width,
      bounds.height,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height
    );
    this.target.restore();
  }

  /** The whole-pixel box on the raster that holds the glyph's ink, `reachPx` wider on each side, once `matrix` has moved it. */
  private inkBounds(
    char: string,
    penX: number,
    baselineY: number,
    reachPx: number,
    matrix: DOMMatrix
  ): PixelBox {
    const ink = this.target.measureText(char);
    const left = penX - ink.actualBoundingBoxLeft - reachPx;
    const right = penX + ink.actualBoundingBoxRight + reachPx;
    const top = baselineY - ink.actualBoundingBoxAscent - reachPx;
    const bottom = baselineY + ink.actualBoundingBoxDescent + reachPx;
    const corners = [
      matrix.transformPoint({ x: left, y: top }),
      matrix.transformPoint({ x: right, y: top }),
      matrix.transformPoint({ x: left, y: bottom }),
      matrix.transformPoint({ x: right, y: bottom }),
    ];
    const x = Math.floor(Math.min(...corners.map((corner) => corner.x)));
    const y = Math.floor(Math.min(...corners.map((corner) => corner.y)));
    return {
      x,
      y,
      width: Math.ceil(Math.max(...corners.map((corner) => corner.x))) - x,
      height: Math.ceil(Math.max(...corners.map((corner) => corner.y))) - y,
    };
  }

  /**
   * The cleared 2D context of `canvas`, at least as large as `box`, drawing text as the raster does
   * under `matrix`, with the box at its origin. Null with no 2D context.
   */
  private scratch(
    canvas: HTMLCanvasElement,
    box: PixelBox,
    matrix: DOMMatrix
  ): CanvasRenderingContext2D | null {
    // A resize clears the canvas and resets its context.
    if (canvas.width < box.width) canvas.width = box.width;
    if (canvas.height < box.height) canvas.height = box.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(new DOMMatrix().translate(-box.x, -box.y).multiply(matrix));
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
