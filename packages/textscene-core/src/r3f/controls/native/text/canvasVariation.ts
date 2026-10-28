/**
 * The font-variation half of `canvasTextPainter.ts`: the embolden padding, the emboldened fill and
 * the ring of an emboldened or sheared glyph. Godot emboldens the contour (`text_server_adv.cpp:1314`),
 * shears it (`:1318`), then strokes the result (`:1383`).
 */
import { variationKey, type GlyphVariation } from './fontMetrics';
import type { GlyphContours } from './glyphContours';
import { traceGlyphContours } from './glyphPath';
import type { SfntOutlines } from './sfntOutlines';
import type { TextLayoutResult } from './textLayout';
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

/** A font size animation adds a face for each size it passes, so the oldest face goes at this count. */
const MAX_CACHED_FACES = 8;

/**
 * The contours read so far, by font, then by size and variation, then by glyph. A repaint at a new
 * tint, such as a modulate animation, reads none again.
 */
const readContours = perObject(
  (_outlines: SfntOutlines) => new Map<string, Map<number, GlyphContours | null>>()
);

/**
 * Reads the outline of a character as the font variation leaves it at `fontSizePx`: null for a
 * glyph the font has no outline for. The face's cache is found once, so a glyph costs one lookup.
 */
export function variedContoursReader(
  outlines: SfntOutlines,
  fontSizePx: number,
  variation: GlyphVariation
): (char: string) => GlyphContours | null {
  const byFace = readContours(outlines);
  const faceKey = `${fontSizePx}/${variationKey(variation)}`;
  let glyphs = byFace.get(faceKey);
  if (!glyphs) {
    if (byFace.size >= MAX_CACHED_FACES) byFace.delete(byFace.keys().next().value!);
    byFace.set(faceKey, (glyphs = new Map()));
  }
  const read = glyphs;
  return (char) => {
    const glyphIndex = outlines.glyphIndex(char.codePointAt(0)!);
    if (glyphIndex === 0) return null;
    let contours = read.get(glyphIndex);
    if (contours === undefined)
      read.set(glyphIndex, (contours = outlines.glyphContours(glyphIndex, fontSizePx, variation)));
    return contours;
  };
}

/** Shears what the context draws next about `baselineY`: x' = x - skew * (y - baselineY), the MSDF path's per-vertex shear (TextRun.tsx's `dx`). */
export function shearAboutBaseline(ctx: CanvasRenderingContext2D, skew: number, baselineY: number): void {
  ctx.transform(1, 0, -skew, 1, skew * baselineY, 0);
}

/** Starts a path of `contours` from the pen. */
function traceContoursFromPen(
  ctx: CanvasRenderingContext2D,
  contours: GlyphContours,
  penX: number,
  baselineY: number
): void {
  ctx.beginPath();
  traceGlyphContours(ctx, contours, penX, baselineY);
}

/**
 * Strokes `contours` from the pen, with the stroke state of `ctx`. The contours carry their own
 * shear, so the caller draws them under no shear transform and the line keeps its width in every
 * direction.
 */
export function strokeContours(
  ctx: CanvasRenderingContext2D,
  contours: GlyphContours,
  penX: number,
  baselineY: number
): void {
  traceContoursFromPen(ctx, contours, penX, baselineY);
  ctx.stroke();
}

/**
 * Fills `contours` from the pen, with the fill state of `ctx`. FreeType fills the grown contour
 * where `fillText` snaps its baseline to a whole pixel, which leaves the fill off the stroke that
 * follows the same contour. The caller draws under no shear transform, as for the stroke.
 *
 * @canonical Fills a glyph outline on a 2D context, from the pen
 */
export function fillContours(
  ctx: CanvasRenderingContext2D,
  contours: GlyphContours,
  penX: number,
  baselineY: number
): void {
  traceContoursFromPen(ctx, contours, penX, baselineY);
  ctx.fill();
}
