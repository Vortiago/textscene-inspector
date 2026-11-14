/**
 * The painter of a face whose outlines this previewer cannot read: each glyph draws as browser
 * text, `fillText` or `strokeText` in the family of its registered `FontFace`. It is the only
 * painter that asks the browser's text rasteriser for a glyph.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import { getFontAscentPx, getFontLinePitchPx } from './fontMetrics';
import { colourRaster } from './glyphCoverage';
import type { GlyphPainter, GlyphReach, PlacedGlyph, RasterFrame } from './glyphPainter';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import type { CanvasTextCanvasLayout } from './canvasTextPainter';
import type { GlyphPlacement } from './textLayout';

// Each glyph draws at the pen `x` `textLayout.ts` computed, so a whole-string `fillText` cannot
// re-shape it with the ligatures or kerning the measurer folded in (`runtimeFontMetrics.ts`).
export const browserTextPainter: GlyphPainter = {
  reachReader: (layout) => (glyph) => textReachPx(glyph, layout.baselineOffsetPx),
  // A face with no family draws no text, as `fillText` paints a host font for an unregistered family.
  paint: (glyphs, { metrics, fontSizePx, skew, canvasLayout }, colour, strokeWidthPx) => {
    const { canvasWidthPx, canvasHeightPx } = canvasLayout;
    if (metrics.cssFontFamily === undefined) return new ImageData(canvasWidthPx, canvasHeightPx);
    const ctx = textContext(canvasLayout, metrics.cssFontFamily, fontSizePx);
    if (!ctx) return null;
    paintGlyphTexts(ctx, glyphs, `rgb(${colour.join(', ')})`, skew, strokeWidthPx);
    const image = ctx.getImageData(0, 0, canvasWidthPx, canvasHeightPx);
    colourRaster(image, colour);
    return image;
  },
  rectReader: textGlyphBoxReader,
};

/**
 * The reach of a glyph the browser draws as text: the ink its face measured, where the face draws
 * the instance `measureText` measures. Else the larger of `lineAscentPx` and its face's own ascent
 * on each side: an ascent bounds the reach of any glyph.
 */
export function textReachPx(glyph: GlyphPlacement, lineAscentPx: number): GlyphReach {
  const face = glyph.fontMetrics;
  const ink =
    isCanvasFontMetrics(face) && !face.drawnOpentype ? face.getGlyphInkUnits?.(glyph.char) : undefined;
  if (!ink) {
    const reachPx = Math.max(lineAscentPx, getFontAscentPx(face, glyph.fontSizePx));
    return { leftPx: reachPx, rightPx: glyph.advance + reachPx };
  }
  const pxPerUnit = glyph.fontSizePx / face.unitsPerEm;
  return {
    leftPx: Math.max(0, ink.left * pxPerUnit),
    rightPx: Math.max(glyph.advance, ink.right * pxPerUnit),
  };
}

/**
 * Reads the box of a glyph the browser draws as text, which has no bitmap grid: from its pen to its
 * advance, between the ascent and the descent of the face, grown by `outlineRadiusPx` on each side
 * as the ring of an outline pass reaches. Godot's rectangle for it is not known. Null on a face that
 * draws no text.
 */
function textGlyphBoxReader(
  { metrics, fontSizePx }: RasterFrame,
  outlineRadiusPx: number
): (glyph: PlacedGlyph) => Rect2 | null {
  if (metrics.cssFontFamily === undefined) return () => null;
  const ascentPx = getFontAscentPx(metrics, fontSizePx);
  const heightPx = getFontLinePitchPx(metrics, fontSizePx, 0);
  return ({ penX, baselineY, placement }) => ({
    x: penX - outlineRadiusPx,
    y: baselineY - ascentPx - outlineRadiusPx,
    w: placement.advance + 2 * outlineRadiusPx,
    h: heightPx + 2 * outlineRadiusPx,
  });
}

/**
 * A CPU canvas the size of the raster, set to the font `cssFontFamily` names: the CPU rasteriser
 * covers by exact area where the GPU raster thins small glyphs (`textRun.md`). Null where the
 * document has no 2D context.
 */
function textContext(
  { canvasWidthPx, canvasHeightPx }: CanvasTextCanvasLayout,
  cssFontFamily: string,
  fontSizePx: number
): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidthPx;
  canvas.height = canvasHeightPx;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${fontSizePx}px "${cssFontFamily}"`;
  return ctx;
}

/**
 * Sets `ctx` to stroke the outline ring of each glyph. FreeType's `FT_Glyph_Stroke` exports both
 * borders, an annulus a centred canvas stroke of the same width paints (`text_server_adv.cpp:1383-1390`).
 * `LINEJOIN_ROUND`/`LINECAP_BUTT` are that stroker's settings (`:1383`).
 */
function setStrokeStyle(ctx: CanvasRenderingContext2D, cssColour: string, strokeWidthPx: number): void {
  ctx.strokeStyle = cssColour;
  ctx.lineWidth = strokeWidthPx;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
}

/**
 * Sets `ctx` to fill each glyph. The stroke of an emboldened fill (`paintEmboldenedFill`) is the
 * fill's colour, mitred as `FT_Outline_Embolden` mitres its corners.
 */
function setFillStyle(ctx: CanvasRenderingContext2D, cssColour: string): void {
  ctx.fillStyle = cssColour;
  ctx.strokeStyle = cssColour;
  ctx.lineJoin = 'miter';
}

/** Paints each glyph of `glyphs` as text, sheared about its own origin as Godot shears a glyph. */
function paintGlyphTexts(
  ctx: CanvasRenderingContext2D,
  glyphs: readonly PlacedGlyph[],
  cssColour: string,
  skew: number,
  strokeWidthPx: number
): void {
  const isStroked = strokeWidthPx > 0;
  if (isStroked) setStrokeStyle(ctx, cssColour, strokeWidthPx);
  else setFillStyle(ctx, cssColour);
  for (const glyph of glyphs) {
    if (skew === 0) {
      paintGlyphText(ctx, glyph, isStroked);
      continue;
    }
    ctx.save();
    shearAboutBaseline(ctx, skew, glyph.baselineY);
    paintGlyphText(ctx, glyph, isStroked);
    ctx.restore();
  }
}

/** Paints `glyph` as text in the style `ctx` holds. */
function paintGlyphText(
  ctx: CanvasRenderingContext2D,
  { placement: { char, emboldenGrowthPx }, penX, baselineY }: PlacedGlyph,
  isStroked: boolean
): void {
  if (isStroked) ctx.strokeText(char, penX, baselineY);
  else if (emboldenGrowthPx) paintEmboldenedFill(ctx, char, penX, baselineY, emboldenGrowthPx);
  else ctx.fillText(char, penX, baselineY);
}

/**
 * Fills the glyph, then strokes it with a centred line of the growth's width, drawn at the
 * shift. Both cover the same ink as the emboldened outline. FreeType mitres the corners, as the
 * `miter` join does, so the caller sets it. `fillText` snaps its baseline to a whole pixel, so the
 * fill can sit up to half a pixel off its own stroke.
 */
function paintEmboldenedFill(
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

/** Shears what the context draws next about `baselineY`: x' = x - skew * (y - baselineY). */
function shearAboutBaseline(ctx: CanvasRenderingContext2D, skew: number, baselineY: number): void {
  ctx.transform(1, 0, -skew, 1, skew * baselineY, 0);
}
