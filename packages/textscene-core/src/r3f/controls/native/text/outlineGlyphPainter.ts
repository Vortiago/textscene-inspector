/**
 * The painter of a face with outlines: each glyph draws as FreeType's bitmap of its contour, or of
 * the ring round it (`glyphCoverage.ts`). A glyph with no contour draws nothing, as Godot draws a
 * glyph only where it has a texture (`text_server_adv.cpp:4042`). It makes no 2D context.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import { recentlyRead } from '../../../../utils/recentlyRead';
import { glyphContoursReader, variedGlyphContoursReader } from './canvasVariation';
import type { GlyphVariation } from './fontMetrics';
import type { GlyphContours } from './glyphContours';
import {
  blendGlyphBitmap,
  colourRaster,
  placedGlyphBitmap,
  type ByteColour,
  type GlyphBitmap,
} from './glyphCoverage';
import {
  hasOwnGlyph,
  type GlyphPainter,
  type GlyphReach,
  type PlacedGlyph,
  type RasterFrame,
} from './glyphPainter';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import type { SfntOutlines } from './sfntOutlines';
import type { GlyphPlacement } from './textLayout';

/** A canvas face that carries the outlines its glyphs draw from. */
export type OutlineFace = CanvasFontMetrics & { readonly outlines: SfntOutlines };

/** Whether `face` carries outlines this previewer can read. */
export function hasOutlines(face: CanvasFontMetrics): face is OutlineFace {
  return face.outlines != null;
}

/** The contours each placement draws, or null for a glyph with no contour. */
type ContoursReader = (gp: GlyphPlacement) => GlyphContours | null;

/** A RichTextLabel line holds a few font sizes. A reader built again costs two cache lookups. */
const MAX_KEPT_SIZES = 8;

/** How far Godot's glyph rectangle reaches past the bitmap on each side (`rect_range`, `text_server_adv.h:187`). */
const GLYPH_RECT_MARGIN_PX = 1;

/** The painter that draws each glyph of `face` from its contours. */
export function outlineGlyphPainter(face: OutlineFace): GlyphPainter {
  return {
    reachReader: (skew) => {
      const contoursAt = recentlyRead<number, ContoursReader>(MAX_KEPT_SIZES);
      return (glyph) => {
        const contoursOf =
          hasOwnGlyph(glyph) &&
          contoursAt(glyph.fontSizePx, (fontSizePx) => placementContoursReader(face, fontSizePx, skew));
        const contours = contoursOf ? contoursOf(glyph) : null;
        return contours ? contourReachPx(contours, glyph.advance) : { leftPx: 0, rightPx: glyph.advance };
      };
    },
    paint: (glyphs, frame, colour) => {
      const contoursOf = placementContoursReader(face, frame.fontSizePx, frame.skew);
      const outlineRadiusPx = frame.strokeWidthPx / 2;
      const bitmaps = glyphs.flatMap(({ placement, penX, baselineY }) => {
        const contours = contoursOf(placement);
        const bitmap = contours && placedGlyphBitmap(contours, penX, baselineY, outlineRadiusPx);
        return bitmap ? [bitmap] : [];
      });
      const { canvasWidthPx, canvasHeightPx } = frame.canvasLayout;
      return glyphRaster(new ImageData(canvasWidthPx, canvasHeightPx), bitmaps, colour);
    },
    rectReader: (frame) => {
      const contoursOf = placementContoursReader(face, frame.fontSizePx, frame.skew);
      return (glyph) => {
        const contours = contoursOf(glyph.placement);
        return contours && glyphBitmapRect(glyph, contours, frame);
      };
    },
  };
}

/**
 * The contours each placement draws at `fontSizePx`, or null for a glyph with no contour. Each
 * contour carries the shear and the embolden, as Godot's FreeType draws it.
 */
function placementContoursReader(face: OutlineFace, fontSizePx: number, skew: number): ContoursReader {
  const variation: GlyphVariation = { embolden: face.embolden ?? 0, skew, opentype: face.drawnOpentype };
  const contoursOfGlyph = variedGlyphContoursReader(face.outlines, fontSizePx, variation);
  const contoursOfChar = glyphContoursReader(face.outlines, contoursOfGlyph, variation.opentype);
  return (gp) => (gp.glyphIndex === undefined ? contoursOfChar(gp.char) : contoursOfGlyph(gp.glyphIndex));
}

/** The reach of the control box of `contours`, which bounds every curve of the outline. */
function contourReachPx({ points }: GlyphContours, advancePx: number): GlyphReach {
  let leftPx = 0;
  let rightPx = advancePx;
  for (const { x } of points) {
    leftPx = Math.max(leftPx, -x);
    rightPx = Math.max(rightPx, x);
  }
  return { leftPx, rightPx };
}

/**
 * `image` with each glyph bitmap laid over it, in `colour`. The image is returned, not put on a
 * canvas, as a canvas keeps no colour under alpha 0 (`colourRaster`).
 */
function glyphRaster(image: ImageData, bitmaps: readonly GlyphBitmap[], colour: ByteColour): ImageData {
  for (const bitmap of bitmaps) blendGlyphBitmap(image, bitmap);
  colourRaster(image, colour);
  return image;
}

/**
 * The bitmap grid of a glyph widened by the margin (`text_server_adv.cpp:1223-1225`), or null for
 * a glyph that draws no pixel. A drawer that keeps the pen draws the bitmap of the whole pen and
 * moves its quad by the rest (`label_3d.cpp:345-349`). A drawer that snaps the pen draws the bitmap
 * of its subpixel step.
 */
function glyphBitmapRect(
  { penX, baselineY }: PlacedGlyph,
  contours: GlyphContours,
  { snapsGlyphs, strokeWidthPx }: RasterFrame
): Rect2 | null {
  const outlineRadiusPx = strokeWidthPx / 2;
  const [bitmapPenX, bitmapBaselineY] = snapsGlyphs
    ? [penX, baselineY]
    : [Math.floor(penX), Math.floor(baselineY)];
  const bitmap = placedGlyphBitmap(contours, bitmapPenX, bitmapBaselineY, outlineRadiusPx);
  if (!bitmap) return null;
  const { left, top, width, height } = bitmap.grid;
  return {
    x: left + (penX - bitmapPenX) - GLYPH_RECT_MARGIN_PX,
    y: top + (baselineY - bitmapBaselineY) - GLYPH_RECT_MARGIN_PX,
    w: width + 2 * GLYPH_RECT_MARGIN_PX,
    h: height + 2 * GLYPH_RECT_MARGIN_PX,
  };
}
