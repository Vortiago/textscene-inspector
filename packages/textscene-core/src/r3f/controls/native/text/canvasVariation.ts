/**
 * The font-variation half of `canvasTextPainter.ts`: the embolden padding, the contours of an
 * emboldened or sheared glyph, and the emboldened text of a glyph with no contour. Godot emboldens the
 * contour (`text_server_adv.cpp:1314`), shears it (`:1318`), then strokes the result (`:1383`).
 */
import { variationKey, type GlyphVariation } from './fontMetrics';
import type { GlyphContours } from './glyphContours';
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

/** A font size animation adds a face for each size it passes, so the least recently read face goes at this count. */
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
export function glyphContoursReader(
  outlines: SfntOutlines,
  fontSizePx: number,
  variation: GlyphVariation
): (char: string) => GlyphContours | null {
  const byFace = readContours(outlines);
  const faceKey = `${fontSizePx}/${variationKey(variation)}`;
  // A hit moves the face to the newest place, so the face dropped at the cap is the least recently read.
  let glyphs = byFace.get(faceKey);
  byFace.delete(faceKey);
  if (!glyphs) {
    if (byFace.size >= MAX_CACHED_FACES) byFace.delete(byFace.keys().next().value!);
    glyphs = new Map();
  }
  byFace.set(faceKey, glyphs);
  const read = glyphs;
  const byChar = new Map<string, GlyphContours | null>();
  return (char) => {
    const known = byChar.get(char);
    if (known !== undefined) return known;
    const glyphIndex = outlines.glyphIndex(char.codePointAt(0)!);
    let contours: GlyphContours | null = null;
    if (glyphIndex !== 0) {
      let cached = read.get(glyphIndex);
      if (cached === undefined)
        read.set(glyphIndex, (cached = outlines.glyphContours(glyphIndex, fontSizePx, variation)));
      contours = cached;
    }
    byChar.set(char, contours);
    return contours;
  };
}

/** Shears what the context draws next about `baselineY`: x' = x - skew * (y - baselineY), the MSDF path's per-vertex shear (TextRunMesh.tsx's `dx`). */
export function shearAboutBaseline(ctx: CanvasRenderingContext2D, skew: number, baselineY: number): void {
  ctx.transform(1, 0, -skew, 1, skew * baselineY, 0);
}
