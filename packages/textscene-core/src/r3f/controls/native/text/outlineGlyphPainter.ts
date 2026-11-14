/**
 * The painter of a face with outlines: each glyph draws as FreeType's bitmap of its contour, or of
 * the ring round it (`glyphCoverage.ts`), and a glyph with a colour form draws its colour bitmap
 * in the fill (`colour/colourGlyphs.ts`). A glyph with no contour draws nothing, as Godot draws a
 * glyph only where it has a texture (`text_server_adv.cpp:4042`). It makes no 2D context.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import { recentlyRead } from '../../../../utils/recentlyRead';
import { glyphContoursReader, variedGlyphContoursReader } from './canvasVariation';
import type { GlyphVariation } from './fontMetrics';
import type { GlyphContours } from './glyphContours';
import { blendGlyphBitmap, colourRaster, placedGlyphBitmap } from './glyphCoverage';
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
import { colourGlyphReader, type ColourGlyphReader } from './colour/colourGlyphs';
import type { ColourBitmap } from './colour/colourBitmap';
import { mixedGlyphRaster, type DrawnGlyph, type RunColours } from './colour/colourGlyphRaster';

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
      const readersAt = recentlyRead<number, PlacementReaders>(MAX_KEPT_SIZES);
      return (glyph) => {
        if (!hasOwnGlyph(glyph)) return { leftPx: 0, rightPx: glyph.advance };
        const { contoursOf, colourOf } = readersAt(glyph.fontSizePx, (fontSizePx) =>
          placementReaders(face, fontSizePx, skew, true)
        );
        const colourForm = colourOf(glyph);
        if (colourForm !== undefined) return colourReachPx(colourForm, glyph.advance);
        const contours = contoursOf(glyph);
        return contours ? contourReachPx(contours, glyph.advance) : { leftPx: 0, rightPx: glyph.advance };
      };
    },
    paint: (glyphs, frame, colours) => {
      const { contoursOf, colourOf } = placementReaders(face, frame.fontSizePx, frame.skew, isFill(frame));
      const outlineRadiusPx = frame.strokeWidthPx / 2;
      const drawn = glyphs.flatMap((glyph): DrawnGlyph[] => {
        const colourForm = colourOf(glyph.placement);
        if (colourForm !== undefined)
          return colourForm ? [{ colour: { bitmap: colourForm, ...colourBitmapOrigin(glyph, frame) } }] : [];
        const contours = contoursOf(glyph.placement);
        const coverage =
          contours && placedGlyphBitmap(contours, glyph.penX, glyph.baselineY, outlineRadiusPx);
        return coverage ? [{ coverage }] : [];
      });
      const { canvasWidthPx, canvasHeightPx } = frame.canvasLayout;
      return glyphRaster(new ImageData(canvasWidthPx, canvasHeightPx), drawn, colours);
    },
    rectReader: (frame) => {
      const { contoursOf, colourOf } = placementReaders(face, frame.fontSizePx, frame.skew, isFill(frame));
      return (glyph) => {
        const colourForm = colourOf(glyph.placement);
        if (colourForm !== undefined) return colourForm && colourBitmapRect(glyph, colourForm, frame);
        const contours = contoursOf(glyph.placement);
        return contours && glyphBitmapRect(glyph, contours, frame);
      };
    },
  };
}

/** Whether `frame` paints the fill. The outline pass loads no colour (`FT_LOAD_NO_BITMAP`, `text_server_adv.cpp:1286-1288`), so it strokes the glyph's own contour. */
function isFill({ strokeWidthPx }: RasterFrame): boolean {
  return strokeWidthPx === 0;
}

/** The colour form of each placement: undefined for a glyph with none, null for one that covers no pixel. */
type ColourFormReader = (gp: GlyphPlacement) => ColourBitmap | null | undefined;

interface PlacementReaders {
  readonly contoursOf: ContoursReader;
  readonly colourOf: ColourFormReader;
}

/** The readers of each placement's contours at `fontSizePx`, and of its colour form where `readsColour`. */
function placementReaders(
  face: OutlineFace,
  fontSizePx: number,
  skew: number,
  readsColour: boolean
): PlacementReaders {
  const contoursOf = placementContoursReader(face, fontSizePx, skew);
  const colourOfGlyph = readsColour ? colourGlyphReader(face.outlines, fontSizePx, face.drawnOpentype) : null;
  return { contoursOf, colourOf: colourOfGlyph ? placementColourReader(face, colourOfGlyph) : noColourForm };
}

const noColourForm: ColourFormReader = () => undefined;

/** `colourOfGlyph` for the glyph of each placement: its shaped glyph, else the `cmap` glyph of its character. */
function placementColourReader(face: OutlineFace, colourOfGlyph: ColourGlyphReader): ColourFormReader {
  return (gp) =>
    colourOfGlyph(gp.glyphIndex ?? face.outlines.glyphIndex(gp.char.codePointAt(0)!, face.drawnOpentype));
}

/**
 * Where a colour bitmap's glyph origin lands. Its layers render with no subpixel shift, so a drawer
 * that snaps the pen draws it at the whole pixel of the pen (`text_server_adv.cpp:4082-4085`), and
 * one that keeps the pen draws its quad at the pen.
 */
function colourBitmapOrigin(
  { penX, baselineY }: PlacedGlyph,
  { snapsGlyphs }: RasterFrame
): { originX: number; originY: number } {
  return snapsGlyphs
    ? { originX: Math.floor(penX), originY: Math.floor(baselineY) }
    : { originX: penX, originY: baselineY };
}

/** The reach of a colour bitmap, which a quad that keeps the pen spreads one pixel further by its filter. */
function colourReachPx(bitmap: ColourBitmap | null, advancePx: number): GlyphReach {
  if (!bitmap) return { leftPx: 0, rightPx: advancePx };
  const { left, width } = bitmap.grid;
  return { leftPx: Math.max(0, 1 - left), rightPx: Math.max(advancePx, left + width + 1) };
}

/** The rectangle of a colour glyph's quad: its bitmap widened by the margin, at its origin. */
function colourBitmapRect(glyph: PlacedGlyph, bitmap: ColourBitmap, frame: RasterFrame): Rect2 {
  const { originX, originY } = colourBitmapOrigin(glyph, frame);
  const { left, top, width, height } = bitmap.grid;
  return {
    x: originX + left - GLYPH_RECT_MARGIN_PX,
    y: originY + top - GLYPH_RECT_MARGIN_PX,
    w: width + 2 * GLYPH_RECT_MARGIN_PX,
    h: height + 2 * GLYPH_RECT_MARGIN_PX,
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
 * `image` with each glyph laid over it: a run of coverage glyphs alone in the font colour, and a run
 * with a colour glyph as `mixedGlyphRaster` lays it. The image is returned, not put on a canvas, as
 * a canvas keeps no colour under alpha 0 (`colourRaster`).
 */
function glyphRaster(image: ImageData, drawn: readonly DrawnGlyph[], colours: RunColours): ImageData {
  if (drawn.some((glyph) => 'colour' in glyph)) return mixedGlyphRaster(image, drawn, colours);
  for (const glyph of drawn) if ('coverage' in glyph) blendGlyphBitmap(image, glyph.coverage);
  colourRaster(image, colours.text);
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
