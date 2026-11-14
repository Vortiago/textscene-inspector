/**
 * The painter of a face with outlines: each glyph draws as FreeType's bitmap of its contour, or of
 * the ring round it (`glyphCoverage.ts`), and a glyph with a colour form draws its colour bitmap
 * in the fill (`colour/colourGlyphs.ts`). A face drawn from a strike loads each glyph at the strike's
 * ppem, its bitmap where the strike has one (`strike/faceStrikes.ts`), and draws every glyph as a
 * quad at the strike's scale. A glyph with no contour draws nothing, as Godot draws a glyph only
 * where it has a texture (`text_server_adv.cpp:4042`). It makes no 2D context.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import { perObject } from '../../../../utils/perObject';
import { recentlyRead } from '../../../../utils/recentlyRead';
import { glyphContoursReader, variedGlyphContoursReader } from './canvasVariation';
import { faceStrikeSize, subpixelStepsPerPx, type GlyphVariation } from './fontMetrics';
import type { BitmapGrid } from './ftGrays';
import type { GlyphContours } from './glyphContours';
import { blendGlyphBitmap, colourRaster, placedGlyphBitmap, type GlyphBitmap } from './glyphCoverage';
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
import { colourGlyphReader } from './colour/colourGlyphs';
import type { ColourBitmap } from './colour/colourBitmap';
import { mixedGlyphRaster, placedQuad, type DrawnGlyph, type RunColours } from './colour/colourGlyphRaster';
import type { StrikeBitmap } from './strike/strikeBitmap';
import type { StrikeSize } from './strike/strikeSize';
import { strikeSvgSize } from './svg/svgGlyphs';

/** A canvas face that carries the outlines its glyphs draw from. */
export type OutlineFace = CanvasFontMetrics & { readonly outlines: SfntOutlines };

/** Whether `face` carries outlines this previewer can read. */
export function hasOutlines(face: CanvasFontMetrics): face is OutlineFace {
  return face.outlines != null;
}

/**
 * What a glyph draws from, at its face's load size: a colour bitmap at its glyph origin, a coverage
 * bitmap at its glyph origin, or its contours, which take the pen's subpixel shift.
 */
type GlyphForm =
  | { readonly colour: ColourBitmap }
  | { readonly coverage: GlyphBitmap }
  | { readonly contours: GlyphContours };

/** The form each placement draws from, or null for a glyph that draws nothing. */
type GlyphFormReader = (gp: GlyphPlacement) => GlyphForm | null;

/** A glyph's form of one kind: null for a glyph that draws nothing, undefined for one that takes another kind. */
type GlyphFormOf = (glyph: number) => GlyphForm | null | undefined;

/** A RichTextLabel line holds a few font sizes. A reader built again costs two cache lookups. */
const MAX_KEPT_SIZES = 8;

/** The size a face loads its glyphs at for `fontSizePx`, and the scale it draws them at. */
interface FaceLoad {
  readonly loadSizePx: number;
  readonly scale: number;
  readonly strike: StrikeSize | null;
}

function faceLoadOf(face: OutlineFace, fontSizePx: number): FaceLoad {
  const strike = faceStrikeSize(face, fontSizePx);
  return strike
    ? { loadSizePx: strike.ppem, scale: strike.scale, strike }
    : { loadSizePx: fontSizePx, scale: 1, strike: null };
}

/** The painter that draws each glyph of `face` from its contours, its colour layers or its strike. */
export function outlineGlyphPainter(face: OutlineFace): GlyphPainter {
  return {
    reachReader: (skew) => {
      const readersAt = recentlyRead<number, { load: FaceLoad; formOf: GlyphFormReader }>(MAX_KEPT_SIZES);
      return (glyph) => {
        if (!hasOwnGlyph(glyph)) return { leftPx: 0, rightPx: glyph.advance };
        const { load, formOf } = readersAt(glyph.fontSizePx, (fontSizePx) => {
          const faceLoad = faceLoadOf(face, fontSizePx);
          return { load: faceLoad, formOf: glyphFormReader(face, faceLoad, skew, true) };
        });
        const form = formOf(glyph);
        return form ? formReachPx(form, load.scale, glyph.advance) : { leftPx: 0, rightPx: glyph.advance };
      };
    },
    paint: (glyphs, frame, colours) => {
      const load = faceLoadOf(face, frame.fontSizePx);
      const formOf = glyphFormReader(face, load, frame.skew, isFill(frame));
      const outlineRadiusPx = frame.strokeWidthPx / 2;
      const drawn = glyphs.flatMap((glyph): DrawnGlyph[] => {
        const form = formOf(glyph.placement);
        const placed = form && drawnGlyph(form, glyph, frame, load, outlineRadiusPx);
        return placed ? [placed] : [];
      });
      const { canvasWidthPx, canvasHeightPx } = frame.canvasLayout;
      return glyphRaster(new ImageData(canvasWidthPx, canvasHeightPx), drawn, colours);
    },
    rectReader: (frame) => {
      const load = faceLoadOf(face, frame.fontSizePx);
      const formOf = glyphFormReader(face, load, frame.skew, isFill(frame));
      return (glyph) => {
        const form = formOf(glyph.placement);
        return form && glyphRect(form, glyph, frame, load);
      };
    },
  };
}

/** Whether `frame` paints the fill. The outline pass loads no colour (`FT_LOAD_NO_BITMAP`, `text_server_adv.cpp:1286-1288`), so it strokes the glyph's own contour. */
function isFill({ strokeWidthPx }: RasterFrame): boolean {
  return strokeWidthPx === 0;
}

/**
 * The reader of each placement's form at the face's load size, as `TT_Load_Glyph` loads it
 * (`ttgload.c:2385-2540`): the strike's bitmap first, then the SVG document and the colour layers
 * where `readsColour`, then the contours. The auto-hinter's load takes the SVG document before the
 * strike (`ftobjs.c:1019-1050`). A face of strikes alone draws nothing where its strike does, and
 * its outline pass draws nothing, as FreeType strokes no bitmap (`text_server_adv.cpp:1390-1392`).
 */
function glyphFormReader(
  face: OutlineFace,
  load: FaceLoad,
  skew: number,
  readsColour: boolean
): GlyphFormReader {
  const { outlines, drawnOpentype } = face;
  const glyphOf = (gp: GlyphPlacement) =>
    gp.glyphIndex ?? outlines.glyphIndex(gp.char.codePointAt(0)!, drawnOpentype);
  const strikeFormOf = strikeFormReader(face, load, readsColour);
  const svgFormOf = readsColour ? svgFormReader(outlines, load) : null;
  const colourOf = readsColour ? colourGlyphReader(outlines, load.loadSizePx, drawnOpentype) : null;
  const colrFormOf = colourOf && ((glyph: number) => colourFormOf(colourOf(glyph)));
  const formReaders = (
    outlines.loadsSvgBeforeStrike
      ? [svgFormOf, strikeFormOf, colrFormOf]
      : [strikeFormOf, svgFormOf, colrFormOf]
  ).filter((formOf) => formOf !== null);
  const contoursOf = placementContoursReader(face, load.loadSizePx, skew);
  return (gp) => {
    const glyph = glyphOf(gp);
    for (const formOf of formReaders) {
      const form = formOf(glyph);
      if (form !== undefined) return form;
    }
    const contours = contoursOf(gp);
    return contours && { contours };
  };
}

/** A glyph's form from a colour reader: undefined where the glyph has no colour form of that kind. */
function colourFormOf(bitmap: ColourBitmap | null | undefined): GlyphForm | null | undefined {
  return bitmap === undefined ? undefined : bitmap && { colour: bitmap };
}

/**
 * The form a glyph takes from its face's `SVG ` documents, at the strike's size where the face
 * loads one: undefined for a glyph with no document, which loads another form.
 */
function svgFormReader(outlines: SfntOutlines, { loadSizePx, strike }: FaceLoad): GlyphFormOf | null {
  const { svgGlyphs } = outlines;
  if (!svgGlyphs) return null;
  const svgOf = svgGlyphs.readerAt(strike ? strikeSvgSize(strike) : svgGlyphs.sizeAt(loadSizePx));
  return (glyph) => colourFormOf(svgOf(glyph));
}

/**
 * The form a glyph takes from its face's strike: undefined where it takes another, as a scalable face
 * draws a glyph its strike lacks, and its outline pass, from its outline. The strike loads only at
 * the default instance (`ttgload.c:2401`).
 */
function strikeFormReader(face: OutlineFace, { strike }: FaceLoad, isFillPass: boolean): GlyphFormOf | null {
  const strikes = face.outlines.strikes;
  if (!strike || !strikes) return null;
  const { isScalable } = strikes;
  if (!isFillPass || face.drawnOpentype) return isScalable ? null : () => null;
  const miss = isScalable ? undefined : null;
  return (glyph) => {
    const bitmap = strikes.bitmapOf(strike.strike, glyph);
    return bitmap ? strikeBitmapForm(bitmap) : miss;
  };
}

/**
 * The form of a strike bitmap as Godot copies it into its glyph texture (`text_server_adv.cpp:
 * 1160-1215`): BGRA as RGBA colour, and 1-bit or 8-bit coverage as coverage. Godot copies no 2-bit
 * or 4-bit bitmap, and draws nothing for one.
 */
const strikeBitmapForm = perObject((bitmap: StrikeBitmap): GlyphForm | null => {
  const grid = { left: bitmap.left, top: -bitmap.top, width: bitmap.width, height: bitmap.rows };
  const pixels = bitmap.width * bitmap.rows;
  const { buffer, pitch } = bitmap;
  switch (bitmap.pixelMode) {
    case 'bgra': {
      const texels = new Uint8Array(pixels * 4);
      for (let row = 0; row < bitmap.rows; row++) {
        for (let column = 0; column < bitmap.width; column++) {
          const from = row * pitch + column * 4;
          const to = (row * bitmap.width + column) * 4;
          texels[to] = buffer[from + 2]!;
          texels[to + 1] = buffer[from + 1]!;
          texels[to + 2] = buffer[from]!;
          texels[to + 3] = buffer[from + 3]!;
        }
      }
      return { colour: { grid, texels } };
    }
    case 'gray': {
      const coverage = new Uint8Array(pixels);
      for (let row = 0; row < bitmap.rows; row++) {
        coverage.set(buffer.subarray(row * pitch, row * pitch + bitmap.width), row * bitmap.width);
      }
      return { coverage: { grid, coverage } };
    }
    case 'mono': {
      const coverage = new Uint8Array(pixels);
      for (let row = 0; row < bitmap.rows; row++) {
        for (let column = 0; column < bitmap.width; column++) {
          const isSet = (buffer[row * pitch + (column >> 3)]! & (0x80 >> (column & 7))) !== 0;
          coverage[row * bitmap.width + column] = isSet ? 255 : 0;
        }
      }
      return { coverage: { grid, coverage } };
    }
    default:
      return null;
  }
});

/**
 * Where a glyph's bitmap origin lands. A bitmap takes no subpixel shift, so a drawer that snaps the
 * pen draws it at the whole pixel of the pen (`text_server_adv.cpp:4082-4085`), and one that keeps
 * the pen, or a scaled face, draws its quad at the pen.
 */
function bitmapOrigin(
  { penX, baselineY }: PlacedGlyph,
  { snapsGlyphs }: RasterFrame
): { originX: number; originY: number } {
  return snapsGlyphs
    ? { originX: Math.floor(penX), originY: Math.floor(baselineY) }
    : { originX: penX, originY: baselineY };
}

/** `form` as it lands on the raster: a scaled face draws every glyph as a quad (`text_server_adv.cpp:4086-4105`). */
function drawnGlyph(
  form: GlyphForm,
  glyph: PlacedGlyph,
  frame: RasterFrame,
  load: FaceLoad,
  outlineRadiusPx: number
): DrawnGlyph | null {
  if (load.scale === 1) {
    if ('colour' in form) return { colour: { bitmap: form.colour, ...bitmapOrigin(glyph, frame), scale: 1 } };
    if ('coverage' in form) return { coverage: movedBitmap(form.coverage, bitmapOrigin(glyph, frame)) };
    const coverage = placedGlyphBitmap(form.contours, glyph.penX, glyph.baselineY, outlineRadiusPx);
    return coverage && { coverage };
  }
  const quadAt = { originX: glyph.penX, originY: glyph.baselineY, scale: load.scale };
  if ('colour' in form) return { colour: { bitmap: form.colour, ...quadAt } };
  const coverage =
    'coverage' in form ? form.coverage : scaledContourBitmap(form.contours, glyph, frame, outlineRadiusPx);
  return coverage && { coverageQuad: { bitmap: coverageTexels(coverage), ...quadAt } };
}

/**
 * The bitmap of a scaled face's contours at its glyph origin, moved by the pen's subpixel step:
 * Godot shifts the outline by the step of the pen before its half step (`text_server_adv.cpp:
 * 4022-4028,1297-1303`), and draws the quad at the pen unfloored.
 */
function scaledContourBitmap(
  contours: GlyphContours,
  { penX }: PlacedGlyph,
  { fontSizePx, snapsGlyphs }: RasterFrame,
  outlineRadiusPx: number
): GlyphBitmap | null {
  const stepsPerPx = snapsGlyphs ? 1 : subpixelStepsPerPx(fontSizePx);
  const shiftPx = Math.floor(stepsPerPx * penX) / stepsPerPx - Math.floor(penX);
  return placedGlyphBitmap(contours, shiftPx, 0, outlineRadiusPx);
}

/** A coverage bitmap as Godot's `FORMAT_LA8` texels: white, with the coverage in alpha. */
const coverageTexels = perObject(({ grid, coverage }: GlyphBitmap): ColourBitmap => {
  const texels = new Uint8Array(coverage.length * 4).fill(255);
  coverage.forEach((level, i) => (texels[i * 4 + 3] = level));
  return { grid, texels };
});

/** `bitmap` with its grid moved from the glyph origin to `origin`. */
function movedBitmap(
  { grid, coverage }: GlyphBitmap,
  { originX, originY }: { originX: number; originY: number }
): GlyphBitmap {
  return { grid: { ...grid, left: grid.left + originX, top: grid.top + originY }, coverage };
}

/** How far a form reaches past the pen box: a quad by its margin at `scale`, which a linear filter spreads a pixel. */
function formReachPx(form: GlyphForm, scale: number, advancePx: number): GlyphReach {
  if ('contours' in form && scale === 1) return contourReachPx(form.contours, advancePx);
  const { left, width } = placedQuad(formGrid(form), 0, 0, scale);
  return { leftPx: Math.max(0, 1 - left), rightPx: Math.max(advancePx, left + width + 1) };
}

/** The pixel box of a form at the glyph origin. */
function formGrid(form: GlyphForm): BitmapGrid {
  if ('colour' in form) return form.colour.grid;
  if ('coverage' in form) return form.coverage.grid;
  return contourGrid(form.contours);
}

/** The pixel box of `contours` at the glyph origin, from its control points. */
function contourGrid({ points }: GlyphContours): BitmapGrid {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const left = Math.floor(minX);
  const top = Math.floor(minY);
  return { left, top, width: Math.ceil(maxX) - left, height: Math.ceil(maxY) - top };
}

/** The rectangle of the quad Godot draws for a glyph, or null for a glyph that draws no pixel. */
function glyphRect(form: GlyphForm, glyph: PlacedGlyph, frame: RasterFrame, load: FaceLoad): Rect2 | null {
  if ('contours' in form && load.scale === 1) return glyphBitmapRect(glyph, form.contours, frame);
  const drawn = drawnGlyph(form, glyph, frame, load, frame.strokeWidthPx / 2);
  if (!drawn) return null;
  if ('coverage' in drawn) return marginRect(drawn.coverage.grid, 0, 0, 1);
  const { bitmap, originX, originY, scale } = 'colour' in drawn ? drawn.colour : drawn.coverageQuad;
  return marginRect(bitmap.grid, originX, originY, scale);
}

function marginRect(grid: GlyphBitmap['grid'], originX: number, originY: number, scale: number): Rect2 {
  const { left, top, width, height } = placedQuad(grid, originX, originY, scale);
  return { x: left, y: top, w: width, h: height };
}

/**
 * The contours each placement draws at `fontSizePx`, or null for a glyph with no contour. Each
 * contour carries the shear and the embolden, as Godot's FreeType draws it.
 */
function placementContoursReader(
  face: OutlineFace,
  fontSizePx: number,
  skew: number
): (gp: GlyphPlacement) => GlyphContours | null {
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
 * with a colour glyph or a quad as `mixedGlyphRaster` lays it. The image is returned, not put on a
 * canvas, as a canvas keeps no colour under alpha 0 (`colourRaster`).
 */
function glyphRaster(image: ImageData, drawn: readonly DrawnGlyph[], colours: RunColours): ImageData {
  if (drawn.some((glyph) => !('coverage' in glyph))) return mixedGlyphRaster(image, drawn, colours);
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
  return marginRect(
    {
      ...bitmap.grid,
      left: bitmap.grid.left + (penX - bitmapPenX),
      top: bitmap.grid.top + (baselineY - bitmapBaselineY),
    },
    0,
    0,
    1
  );
}
