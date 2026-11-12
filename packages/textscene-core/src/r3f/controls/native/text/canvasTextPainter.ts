/**
 * The canvas glyph painter: one raster and one quad for a run of a scene font file or of the
 * bundled font, each glyph as FreeType's bitmap of its outline. It runs for
 * `TextLayoutResult.fontMetrics.kind === 'canvas'`.
 */
// Each glyph draws at the pen `x` `textLayout.ts` computed, so a whole-string `fillText` cannot
// re-shape it with the ligatures or kerning the measurer folded in (`runtimeFontMetrics.ts`).
import * as THREE from 'three';
import {
  glyphContoursReader,
  variedGlyphContoursReader,
  maxEmboldenGrowthPx,
  paintEmboldenedFill,
  shearAboutBaseline,
} from './canvasVariation';
import {
  blendGlyphBitmap,
  colourRaster,
  placedGlyphBitmap,
  type ByteColour,
  type GlyphBitmap,
} from './glyphCoverage';
import type { GlyphContours } from './glyphContours';
import {
  canvasGlyphPenXPx,
  drawnOpentype,
  fontIsScaled,
  getFontAscentPx,
  type FontMetrics,
  type GlyphVariation,
} from './fontMetrics';
import type { GlyphPlacement, TextLayoutResult } from './textLayout';
import { isCanvasFontMetrics, type CanvasFontMetrics } from './runtimeFontMetrics';
import { canvasItemFacing } from '../../../canvasItemFacing';
import type { CanvasItemPixelMaterial } from '../../../components/LitCanvasItemPixels';
import { injectProgram, injectViewportProgram } from '../../../materialProgramInputs';
import { NO_OPAQUE_PREPASS } from '../../../materials/opaquePrepass';
import { passBlendMaterialProps, type SurfaceBlend } from '../../../materials/surfaceBlend';
import { CANVAS_SRGB_DEFINES } from '../../../canvasSrgbMultiply';
import type { SurfaceShading } from '../../../materialFor2d';
import type { Rgba } from '../../../../godot/math/math';
import { GLYPH_DRAWER_RULES, type GlyphDrawer } from './glyphDrawer';
import { fposmodp } from '../../../../godot/math/math';
import { VECTOR2_ZERO, type Vector2 } from '../../../../godot/math/vector';
import { channelToByte } from '../../../../utils/colorSpace';

/** Fixed vertical pad, CSS px, on every raster edge: anti-aliased ink can overshoot a glyph's ascent/descent box. The quad is this much taller than `layout.heightPx` on both edges. */
const CANVAS_TEXT_VERTICAL_PAD_PX = 4;

/**
 * The whole raster pixels a CSS-px extent needs, one texel per font pixel as Godot caches a glyph
 * (`label_3d.cpp:345-350`). The quad samples the whole canvas, so rounding once, here, for both
 * halves keeps the content box at the quad origin for every padding, and Label3D's outline and
 * fill line up.
 */
function wholeRasterPx(cssPx: number): number {
  return Math.max(1, Math.ceil(cssPx));
}

export interface CanvasTextCanvasLayout {
  /** `HTMLCanvasElement#width`: the drawn extent (`drawnExtentPx`), plus both pads and the origin phase, rounded up to a whole pixel. */
  canvasWidthPx: number;
  /** `HTMLCanvasElement#height`: `layout.heightPx` plus twice `offsetYPx`, rounded up to a whole pixel. */
  canvasHeightPx: number;
  /**
   * Where the unpadded content box (x=0 in `layout`) sits in the raster, CSS px: the shear, stroke and
   * embolden pad, plus the whole pixels of ink left of x=0, less those right of it (`drawnExtentPx`).
   */
  offsetXPx: number;
  /** Top padding, CSS px: `CANVAS_TEXT_VERTICAL_PAD_PX` plus any outline-stroke reach. */
  offsetYPx: number;
}

/**
 * Sizes the raster canvas for `layout`, at a synthesised-italic `skew` (0 is
 * upright) and outline `strokeWidthPx` (0 is filled). The horizontal pad is
 * split evenly, so the quad stays centred on the ink of the glyphs (`drawnExtentPx`). Pure: no DOM.
 */
export function computeCanvasTextCanvasLayout(
  layout: TextLayoutResult,
  skew: number,
  strokeWidthPx = 0,
  originPhasePx: Readonly<Vector2> = VECTOR2_ZERO
): CanvasTextCanvasLayout {
  // A centred stroke reaches half its width outside the contour on every side,
  // horizontally too, where an upright fill needs no pad.
  const strokePadPx = strokeWidthPx / 2;
  // An embolden reaches its full growth right and up. The pad is symmetric, so the quad stays centred.
  const emboldenPadPx = maxEmboldenGrowthPx(layout);
  const offsetYPx = CANVAS_TEXT_VERTICAL_PAD_PX + Math.ceil(strokePadPx + emboldenPadPx);
  // The worst-case shear offset over a line's rows, `dx(y) = -skew * (y - baselinePx)`: every row
  // of the raster above the baseline. A font's
  // descent is shorter than its ascent, so the rows below shear less.
  const shearPadPx = Math.abs(skew) * (layout.baselineOffsetPx + offsetYPx);
  // Whole pixels, as Godot draws a glyph texture texel-aligned: a fractional pad puts each texel
  // between two screen pixels, and the linear filter thins every edge.
  const padXPx = Math.ceil(shearPadPx + strokePadPx + emboldenPadPx);
  const { startPx, endPx } = drawnExtentPx(layout, skew);
  const inkLeftPx = Math.floor(startPx);
  return {
    // The quad sits `originPhasePx.x` left of the run origin, so the content reaches that much further right.
    canvasWidthPx: wholeRasterPx(endPx - inkLeftPx + 2 * padXPx + originPhasePx.x),
    canvasHeightPx: wholeRasterPx(layout.heightPx + 2 * offsetYPx),
    offsetXPx: padXPx - inkLeftPx,
    offsetYPx,
  };
}

/**
 * Whole pixels past a glyph's reach that its drawn ink can land. The painter floors a pen by up to
 * 1 px (`canvasGlyphPenXPx`) or rounds it a quarter pixel right, and a hinted outline grid-fits under
 * half a pixel past its measured box: 1.5 px on the left, 0.75 px on the right.
 */
const INK_SLACK_LEFT_PX = 2;
const INK_SLACK_RIGHT_PX = 1;

/** How far the ink of a glyph reaches left of its pen and right of it, px, its pen box included. */
interface GlyphReach {
  leftPx: number;
  rightPx: number;
}

/**
 * The span of the ink of the glyphs at `skew`, their pen boxes, the pen snap and the hinting
 * included. Godot draws each glyph quad whole wherever its side bearing reaches, which a raster of
 * the line box would clip. The run of a fallback face keeps its glyphs at their places on the line
 * (`faceLayouts.ts`), so its raster spans them alone. A layout with no glyph spans its width.
 */
function drawnExtentPx(layout: TextLayoutResult, skew: number): { startPx: number; endPx: number } {
  let startPx = Infinity;
  let endPx = -Infinity;
  const reachOf = glyphReachReader(layout, skew);
  for (const { glyphs } of layout.lines) {
    for (const glyph of glyphs) {
      const { leftPx, rightPx } = reachOf(glyph);
      const originX = glyph.x + (glyph.xOffset ?? 0);
      startPx = Math.min(startPx, originX - leftPx - INK_SLACK_LEFT_PX);
      endPx = Math.max(endPx, originX + rightPx + INK_SLACK_RIGHT_PX);
    }
  }
  return startPx === Infinity ? { startPx: 0, endPx: layout.widthPx } : { startPx, endPx };
}

/**
 * Reads the reach of each glyph of `layout` from what the paint draws for it, one rule for every
 * font: the box of its contours, or the browser's ink for a glyph the browser draws as text. A
 * glyph with neither draws nothing, and spans its pen box.
 */
function glyphReachReader(layout: TextLayoutResult, skew: number): (glyph: GlyphPlacement) => GlyphReach {
  const face = layout.fontMetrics;
  if (!isCanvasFontMetrics(face)) return (glyph) => textReachPx(glyph, layout.baselineOffsetPx);
  const contoursOf = perFontSize((fontSizePx) => placementContoursReader(face, fontSizePx, skew));
  const drawsText = face.cssFontFamily !== undefined;
  return (glyph) => {
    const contours = hasOwnGlyph(glyph) ? contoursOf(glyph.fontSizePx)(glyph) : null;
    if (contours) return contourReachPx(contours, glyph.advance);
    return drawsText ? textReachPx(glyph, layout.baselineOffsetPx) : { leftPx: 0, rightPx: glyph.advance };
  };
}

/** `read`, kept for each font size it has read: a run holds one size, and a RichTextLabel line a few. */
function perFontSize<T>(read: (fontSizePx: number) => T): (fontSizePx: number) => T {
  const bySize = new Map<number, T>();
  return (fontSizePx) => {
    let value = bySize.get(fontSizePx);
    if (value === undefined) bySize.set(fontSizePx, (value = read(fontSizePx)));
    return value;
  };
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
 * The reach of a glyph the browser draws as text: the ink its face measured, where the face draws
 * the instance `measureText` measures. Else the larger of `lineAscentPx` and its face's own ascent
 * on each side: an ascent bounds the reach of any glyph.
 */
function textReachPx(glyph: GlyphPlacement, lineAscentPx: number): GlyphReach {
  const face = glyph.fontMetrics;
  const ink =
    isCanvasFontMetrics(face) && !drawnOpentype(face) ? face.getGlyphInkUnits?.(glyph.char) : undefined;
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

/** The vertex, UV and index buffers of the one quad of a raster. */
export interface CanvasTextQuadArrays {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/**
 * One quad spanning the padded raster, placed so the layout origin is at x = 0, in Godot px, +Y
 * down, negated to three's Y-up. The quad
 * covers the ink of the glyphs (`drawnExtentPx`). It moves back by `originPhasePx`, so its texels
 * land on the item's whole pixels.
 */
export function buildCanvasTextQuadArrays(
  canvasLayout: CanvasTextCanvasLayout,
  originPhasePx: Readonly<Vector2> = VECTOR2_ZERO
): CanvasTextQuadArrays {
  const left = -canvasLayout.offsetXPx - originPhasePx.x;
  // The whole canvas, not `layout.widthPx + offsetXPx`: the rounding slack sits
  // on this edge, and the quad must span it or the raster samples stretched.
  const right = left + canvasLayout.canvasWidthPx;
  const top = -canvasLayout.offsetYPx - originPhasePx.y;
  const bottom = top + canvasLayout.canvasHeightPx;

  // Vertex order TL, TR, BL, BR.
  const positions = new Float32Array([left, -top, 0, right, -top, 0, left, -bottom, 0, right, -bottom, 0]);
  // flipY=true: v=1 at the texture's own top row (image-space y=0).
  const uvs = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
  const indices = new Uint32Array([2, 3, 0, 3, 1, 0]);
  return { positions, uvs, indices };
}

/**
 * Whether a run places its glyphs as a canvas item draws a glyph at scale 1: the pen on its subpixel
 * step and the baseline floored (`text_server_adv.cpp:4082-4084`). A scaled face (`fontIsScaled`)
 * draws off that branch, as Label3D's mesh does.
 */
export function snapsGlyphsToItemPixels(
  glyphDrawer: GlyphDrawer,
  fontSizePx: number,
  metrics: Pick<FontMetrics, 'pxPerUnit'>
): boolean {
  return GLYPH_DRAWER_RULES[glyphDrawer].roundsPen && !fontIsScaled(fontSizePx, metrics);
}

/**
 * How far a run's place in its canvas item sits past the whole pixel at or before it. A run that places
 * its glyphs as a canvas item does starts its quad on that pixel, as Godot draws a glyph texel-aligned
 * (`text_server_adv.cpp:4082-4084`). The phase alone sets the paint, so a whole-pixel move repaints nothing.
 */
export function originPhase(placePx: Readonly<Vector2>): Vector2 {
  return { x: fposmodp(placePx.x, 1), y: fposmodp(placePx.y, 1) };
}

/**
 * The opaque colour of a Godot sRGB colour's 0-1 channels, unconverted: canvas fill colours are
 * sRGB, and the `SRGBColorSpace` texture gets three's decode. The material's `opacity` applies
 * `tint.a` once.
 */
function opaqueByteColour(tint: Pick<Rgba, 'r' | 'g' | 'b'>): ByteColour {
  return [channelToByte(tint.r), channelToByte(tint.g), channelToByte(tint.b)];
}

/**
 * `image` with each glyph bitmap laid over it, in `colour`. The image is returned, not put on the
 * canvas, as a canvas keeps no colour under alpha 0 (`colourRaster`).
 */
function glyphRaster(image: ImageData, bitmaps: readonly GlyphBitmap[], colour: ByteColour): ImageData {
  for (const bitmap of bitmaps) blendGlyphBitmap(image, bitmap);
  colourRaster(image, colour);
  return image;
}

/**
 * Whether a placement draws a glyph of its own. A hex-code box draws as quads (`TextRunMesh`), so the
 * text the font lacks never reaches a host font.
 */
function hasOwnGlyph(gp: GlyphPlacement): boolean {
  if (gp.char === ' ' || gp.char === '\n' || gp.char === '\r') return false;
  return gp.controlCodepoint === undefined;
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
 * Sets `ctx` to stroke the outline ring of each glyph. A glyph with no contour strokes its text:
 * FreeType's `FT_Glyph_Stroke` exports both borders, an annulus a centred canvas stroke of the same
 * width paints (`text_server_adv.cpp:1383-1390`). `LINEJOIN_ROUND`/`LINECAP_BUTT` are that
 * stroker's settings (`:1383`).
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

/** A glyph at its place in the raster, with the contours it draws, or null where it draws as text. */
interface PlacedGlyph {
  char: string;
  penX: number;
  baselineY: number;
  emboldenGrowthPx: number | undefined;
  contours: GlyphContours | null;
}

export interface CanvasTextPaintOptions {
  /** A positive width paints the outline ring instead of the fill, as Godot's separate outline surface (`label_3d.cpp:610-615`). */
  strokeWidthPx?: number;
  /**
   * The Godot code that draws the glyphs, `'canvasItem'` by default: a canvas item puts the pen on its
   * subpixel step (`canvasGlyphPenXPx`) and floors the baseline. A Label3D mesh keeps both (`glyphDrawer.ts`).
   */
  glyphDrawer?: GlyphDrawer;
  /** The `originPhase` of the run's place in its canvas item, which the pen and the baseline include. Zero by default. */
  originPhasePx?: Readonly<Vector2>;
}

/**
 * Draws `layout`, shaped against a `'canvas'`-kind `FontMetrics`, glyph by glyph
 * at each `GlyphPlacement.x`.
 * `skew` shears each glyph's ink about its own baseline. With the `outlines` its metrics carry, each
 * glyph draws as FreeType's bitmap of its contour, or of the ring round it (`glyphCoverage.ts`). The
 * contour carries the embolden and the shear, so a shear does not shear the ring's width. Null where
 * a glyph draws as text and the document has no 2D context.
 */
// Happy-dom has no 2D context, so a unit test gives the canvas a recording one and reads its calls
// and the raster it returns.
export function paintSceneFontCanvas(
  layout: TextLayoutResult,
  fontSizePx: number,
  tint: Rgba,
  skew: number,
  canvasLayout: CanvasTextCanvasLayout,
  { strokeWidthPx = 0, glyphDrawer = 'canvasItem', originPhasePx = VECTOR2_ZERO }: CanvasTextPaintOptions = {}
): ImageData | null {
  const metrics = layout.fontMetrics;
  if (!isCanvasFontMetrics(metrics)) {
    throw new Error('paintSceneFontCanvas requires a layout shaped against a canvas-kind FontMetrics');
  }
  const frame: RasterFrame = {
    metrics,
    fontSizePx,
    canvasLayout,
    originPhasePx,
    snapsGlyphs: snapsGlyphsToItemPixels(glyphDrawer, fontSizePx, metrics),
    contoursOf: placementContoursReader(metrics, fontSizePx, skew),
  };
  const glyphs = placeGlyphs(layout, frame);
  const textGlyphs = glyphs.filter((glyph) => !glyph.contours);
  const colour = opaqueByteColour(tint);
  const { canvasWidthPx, canvasHeightPx } = canvasLayout;
  const { cssFontFamily } = metrics;
  // Only a paint with a glyph drawn as text needs a canvas: a bitmap lays on the raster alone. A
  // face with no family draws no text, as `fillText` paints a host font for an unregistered family.
  let image: ImageData;
  if (cssFontFamily !== undefined && textGlyphs.length > 0) {
    const ctx = textContext(canvasLayout, cssFontFamily, fontSizePx);
    if (!ctx) return null;
    paintGlyphTexts(ctx, textGlyphs, `rgb(${colour.join(', ')})`, skew, strokeWidthPx);
    image = ctx.getImageData(0, 0, canvasWidthPx, canvasHeightPx);
  } else image = new ImageData(canvasWidthPx, canvasHeightPx);
  const outlineRadiusPx = strokeWidthPx / 2;
  const bitmaps = glyphs.flatMap(({ contours, penX, baselineY }) => {
    const bitmap = contours && placedGlyphBitmap(contours, penX, baselineY, outlineRadiusPx);
    return bitmap ? [bitmap] : [];
  });
  return glyphRaster(image, bitmaps, colour);
}

/**
 * The contours each placement of `layout` draws, or null for a glyph that draws as text: every
 * glyph of a face with no outlines, and a glyph with no contour. Each contour carries the shear and
 * the embolden, as Godot's FreeType draws it.
 */
function placementContoursReader(
  metrics: CanvasFontMetrics,
  fontSizePx: number,
  skew: number
): (gp: GlyphPlacement) => GlyphContours | null {
  const outlines = metrics.outlines;
  if (!outlines) return () => null;
  const variation: GlyphVariation = {
    embolden: metrics.embolden ?? 0,
    skew,
    opentype: drawnOpentype(metrics),
  };
  const contoursOfGlyph = variedGlyphContoursReader(outlines, fontSizePx, variation);
  const contoursOfChar = glyphContoursReader(outlines, contoursOfGlyph, variation.opentype);
  return (gp) => (gp.glyphIndex === undefined ? contoursOfChar(gp.char) : contoursOfGlyph(gp.glyphIndex));
}

/** Where a raster sits against the run origin, and whether its glyphs snap to whole item pixels. */
interface RasterFrame {
  readonly metrics: CanvasFontMetrics;
  readonly fontSizePx: number;
  readonly canvasLayout: CanvasTextCanvasLayout;
  readonly originPhasePx: Readonly<Vector2>;
  readonly snapsGlyphs: boolean;
  readonly contoursOf: (gp: GlyphPlacement) => GlyphContours | null;
}

/** Each glyph of `layout` that draws, at its pen and baseline in the raster. */
function placeGlyphs(
  layout: TextLayoutResult,
  { metrics, fontSizePx, canvasLayout, originPhasePx, snapsGlyphs, contoursOf }: RasterFrame
): PlacedGlyph[] {
  // The raster starts at the whole item pixel at or before the run origin, where its quad sits.
  return layout.lines.flatMap((line, lineIndex) => {
    const lineBaselinePx = lineIndex * layout.linePitchPx + layout.baselineOffsetPx;
    const baselineY =
      canvasLayout.offsetYPx + (snapsGlyphs ? Math.floor(originPhasePx.y + lineBaselinePx) : lineBaselinePx);
    return line.glyphs.filter(hasOwnGlyph).map((gp) => {
      // Godot snaps the glyph's origin, the pen plus its offset (`shaped_text_draw`).
      const originX = gp.x + (gp.xOffset ?? 0);
      const penX =
        canvasLayout.offsetXPx +
        (snapsGlyphs ? canvasGlyphPenXPx(originPhasePx.x + originX, fontSizePx, metrics) : originX);
      return {
        char: gp.char,
        penX,
        baselineY: baselineY + (gp.yOffset ?? 0),
        emboldenGrowthPx: gp.emboldenGrowthPx,
        contours: contoursOf(gp),
      };
    });
  });
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
  { char, penX, baselineY, emboldenGrowthPx }: PlacedGlyph,
  isStroked: boolean
): void {
  if (isStroked) ctx.strokeText(char, penX, baselineY);
  else if (emboldenGrowthPx) paintEmboldenedFill(ctx, char, penX, baselineY, emboldenGrowthPx);
  else ctx.fillText(char, penX, baselineY);
}

interface CanvasTextMaterialOptions extends Partial<SurfaceBlend> {
  map: THREE.Texture;
  /** Multiplies the raster's anti-aliasing alpha. The raster is opaque, so this is the only place `tint.a` applies. */
  opacity: number;
  /** The linear colour that multiplies the map. Omitted, white: a canvas raster has its tint baked in. A BMFont page does not. */
  color?: THREE.ColorRepresentation;
  /** `false` by default. */
  depthTest?: boolean;
  /** Omitted, it takes `canvasItemFacing()`'s side. */
  side?: THREE.Side;
  clippingPlanes?: readonly THREE.Plane[];
  /** The lit Control's blend state and light-list sampling, or omitted for an unlit run. `injection` wins: no 2D light reaches a Label3D blend run. */
  pixelMaterial?: CanvasItemPixelMaterial;
  /** The raster carries a mip chain and draws in 3D, so it samples at the viewport's mipmap bias. */
  mipmapped?: boolean;
  /** The PBR uniforms of a run lit by the scene's 3D lights, as a shaded Label3D. Omitted, unlit. */
  shading?: SurfaceShading;
}

/**
 * A `MeshBasicMaterial` for canvas-rasterised text, or a `MeshStandardMaterial` for a lit run,
 * with three's sRGB decode for an `SRGBColorSpace` map. A `NoColorSpace` map gets the
 * sRGB-multiply define (`canvasSrgbMultiply.ts`) from its own tag, as `canvasMapProps` does, so
 * the tag and the define never apply apart. `TextRunMesh.tsx` keeps its glyph raster
 * `SRGBColorSpace`: a glyph has no differing RGB pair to filter wrongly.
 */
// `defines` is assigned after construction: `Material#setValues` skips, with a
// warning, a key not already on the instance, and `MeshBasicMaterial` declares no
// `defines`. The merge keeps the `STANDARD` define `MeshStandardMaterial` declares.
export function createCanvasTextMaterial(
  options: CanvasTextMaterialOptions
): THREE.MeshBasicMaterial | THREE.MeshStandardMaterial {
  const {
    map,
    opacity,
    color,
    depthTest = false,
    side,
    clippingPlanes = [],
    transparent = true,
    depthWrite = false,
    alphaTest = 0,
    alphaHash = false,
    alphaHashScale = 1,
    opaquePrepass = NO_OPAQUE_PREPASS,
    blending = THREE.NormalBlending,
    antialiasing = null,
    injection,
    pixelMaterial,
    mipmapped = false,
    shading,
  } = options;
  const { injection: pixelInjection, ...pixelState } = pixelMaterial ?? {};
  const parameters = {
    map,
    opacity,
    ...(color !== undefined && { color }),
    depthTest,
    ...passBlendMaterialProps({
      transparent,
      depthWrite,
      alphaTest,
      alphaHash,
      blending,
      alphaHashScale,
      opaquePrepass,
      antialiasing,
    }),
    // Unlike `defines` below, `forceSinglePass` IS a property `THREE.Material`'s
    // constructor declares, so `setValues` assigns it from this object.
    ...canvasItemFacing(side),
    clippingPlanes: [...clippingPlanes],
  };
  const material = shading
    ? new THREE.MeshStandardMaterial({ ...parameters, ...shading })
    : new THREE.MeshBasicMaterial(parameters);
  if (map.colorSpace === THREE.NoColorSpace) {
    material.defines = { ...material.defines, ...CANVAS_SRGB_DEFINES };
  }
  // An explicit `side` outranks the facing the pixel material carries.
  material.setValues(side === undefined ? pixelState : { ...pixelState, side });
  const programInjection = injection ?? pixelInjection;
  if (mipmapped) injectViewportProgram(material, programInjection);
  else injectProgram(material, programInjection);
  return material;
}
