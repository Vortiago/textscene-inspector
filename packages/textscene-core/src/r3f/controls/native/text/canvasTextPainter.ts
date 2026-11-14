/**
 * The canvas glyph painter: one raster and one quad for a run of a scene font file or of the
 * bundled font. It runs for `TextLayoutResult.fontMetrics.kind === 'canvas'`, and chooses one
 * painter for the run (`glyphPainter.ts`): the contours of a face with outlines, else browser
 * text, else nothing.
 */
import * as THREE from 'three';
import { maxEmboldenGrowthPx } from './canvasVariation';
import type { ByteColour } from './glyphCoverage';
import { canvasGlyphPenXPx, fontIsScaled, type FontMetrics } from './fontMetrics';
import type { TextLayoutResult } from './textLayout';
import { isCanvasFontMetrics, type CanvasFontMetrics } from './runtimeFontMetrics';
import { hasOwnGlyph, type GlyphPainter, type PlacedGlyph, type RasterFrame } from './glyphPainter';
import { hasOutlines, outlineGlyphPainter } from './outlineGlyphPainter';
import { browserTextPainter } from './browserTextPainter';
import { blankGlyphPainter } from './blankGlyphPainter';
import { canvasItemFacing } from '../../../canvasItemFacing';
import type { CanvasItemPixelMaterial } from '../../../components/LitCanvasItemPixels';
import { injectProgram, injectViewportProgram } from '../../../materialProgramInputs';
import { NO_OPAQUE_PREPASS } from '../../../materials/opaquePrepass';
import { passBlendMaterialProps, type SurfaceBlend } from '../../../materials/surfaceBlend';
import { CANVAS_SRGB_DEFINES } from '../../../canvasSrgbMultiply';
import type { SurfaceShading } from '../../../materialFor2d';
import type { Rgba } from '../../../../godot/math/math';
import { GLYPH_DRAWER_RULES, drawsGlyphRect, type GlyphDrawer } from './glyphDrawer';
import { fposmodp } from '../../../../godot/math/math';
import { VECTOR2_ZERO, type Vector2 } from '../../../../godot/math/vector';
import type { Rect2 } from '../../../../godot/math/rect2';
import { channelToByte } from '../../../../utils/colorSpace';
import { WHITE_MODULATE } from '../../../canvasItemModulate';

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

/**
 * The span of the ink of the glyphs at `skew` as the painter draws them, pen boxes, pen snap and
 * hinting included: Godot draws a glyph quad whole past its side bearing. A fallback face's run keeps
 * its glyphs at their places on the line (`faceLayouts.ts`), so its raster spans them alone. A layout
 * with no glyph spans its width.
 */
function drawnExtentPx(layout: TextLayoutResult, skew: number): { startPx: number; endPx: number } {
  let startPx = Infinity;
  let endPx = -Infinity;
  const reachOf = painterOf(canvasFaceOf(layout)).reachReader(skew, layout.baselineOffsetPx);
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
  // The whole canvas, not `layout.widthPx + offsetXPx`: the rounding slack sits
  // on this edge, and the quad must span it or the raster samples stretched.
  const wholeRaster = { x: 0, y: 0, w: canvasLayout.canvasWidthPx, h: canvasLayout.canvasHeightPx };
  return buildCanvasGlyphQuadArrays([wholeRaster], canvasLayout, originPhasePx);
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
  /**
   * The colour that tints a colour glyph's texels in place of the tint's colour. Godot keeps only the
   * alpha of the font colour for one (`text_server_adv.cpp:4044-4046`), so a canvas item's modulate
   * alone tints it. White by default.
   */
  colourGlyphTint?: Pick<Rgba, 'r' | 'g' | 'b'>;
}

/**
 * The painter of a run on `face`: the contours of a face with outlines, else the text of its
 * `FontFace`, else nothing.
 */
function painterOf(face: CanvasFontMetrics): GlyphPainter {
  if (hasOutlines(face)) return outlineGlyphPainter(face);
  return face.cssFontFamily === undefined ? blankGlyphPainter : browserTextPainter(face);
}

/** The face `layout` was shaped against, which a canvas text run requires to be a canvas face. */
function canvasFaceOf(layout: TextLayoutResult): CanvasFontMetrics {
  const face = layout.fontMetrics;
  if (!isCanvasFontMetrics(face)) {
    throw new Error(`expected a layout shaped against a canvas face, got a ${face.kind} face`);
  }
  return face;
}

/**
 * Draws `layout`, shaped against a `'canvas'`-kind `FontMetrics`, glyph by glyph at each
 * `GlyphPlacement.x`, by the one painter its face takes. `skew` shears each glyph's ink about its
 * own baseline. Null where the browser text painter runs and the document has no 2D context.
 */
// Happy-dom has no 2D context, so a unit test gives the canvas a recording one and reads its calls
// and the raster it returns.
export function paintSceneFontCanvas(
  layout: TextLayoutResult,
  fontSizePx: number,
  tint: Rgba,
  skew: number,
  canvasLayout: CanvasTextCanvasLayout,
  {
    strokeWidthPx = 0,
    glyphDrawer = 'canvasItem',
    originPhasePx = VECTOR2_ZERO,
    colourGlyphTint = WHITE_MODULATE,
  }: CanvasTextPaintOptions = {}
): ImageData | null {
  const frame = rasterFrame(layout, fontSizePx, skew, canvasLayout, glyphDrawer, strokeWidthPx);
  const glyphs = placeGlyphs(layout, frame, originPhasePx);
  const colours = { text: opaqueByteColour(tint), colourGlyphs: opaqueByteColour(colourGlyphTint) };
  return painterOf(frame.metrics).paint(glyphs, frame, colours);
}

/** The frame of the raster `canvasLayout` sizes for `layout`, which a canvas face shaped. */
function rasterFrame(
  layout: TextLayoutResult,
  fontSizePx: number,
  skew: number,
  canvasLayout: CanvasTextCanvasLayout,
  glyphDrawer: GlyphDrawer,
  strokeWidthPx: number
): RasterFrame {
  const metrics = canvasFaceOf(layout);
  return {
    metrics,
    fontSizePx,
    skew,
    canvasLayout,
    snapsGlyphs: snapsGlyphsToItemPixels(glyphDrawer, fontSizePx, metrics),
    strokeWidthPx,
  };
}

/**
 * Each glyph of `layout` that draws, at its pen and baseline in the raster. `originPhasePx` is the
 * phase of the run's place in its canvas item, which a snapped pen and baseline include.
 */
function placeGlyphs(
  layout: TextLayoutResult,
  { metrics, fontSizePx, canvasLayout, snapsGlyphs }: RasterFrame,
  originPhasePx: Readonly<Vector2>
): PlacedGlyph[] {
  // The raster starts at the whole item pixel at or before the run origin, where its quad sits.
  return layout.lines.flatMap((line, lineIndex) => {
    const lineBaselinePx = lineIndex * layout.linePitchPx + layout.baselineOffsetPx;
    const baselineY =
      canvasLayout.offsetYPx + (snapsGlyphs ? Math.floor(originPhasePx.y + lineBaselinePx) : lineBaselinePx);
    return line.glyphs.filter(hasOwnGlyph).map((placement) => {
      // Godot snaps the glyph's origin, the pen plus its offset (`shaped_text_draw`).
      const originX = placement.x + (placement.xOffset ?? 0);
      const penX =
        canvasLayout.offsetXPx +
        (snapsGlyphs ? canvasGlyphPenXPx(originPhasePx.x + originX, fontSizePx, metrics) : originX);
      return { placement, penX, baselineY: baselineY + (placement.yOffset ?? 0) };
    });
  });
}

/**
 * The rectangle of the quad Godot draws for each glyph of `layout`, in raster px, as its painter
 * reads it. A glyph `glyphDrawer` skips has none (`glyphDrawer.ts`).
 */
export function canvasGlyphRects(
  layout: TextLayoutResult,
  fontSizePx: number,
  skew: number,
  canvasLayout: CanvasTextCanvasLayout,
  { strokeWidthPx = 0, glyphDrawer = 'canvasItem', originPhasePx = VECTOR2_ZERO }: CanvasTextPaintOptions = {}
): Rect2[] {
  const frame = rasterFrame(layout, fontSizePx, skew, canvasLayout, glyphDrawer, strokeWidthPx);
  const rectOf = painterOf(frame.metrics).rectReader(frame);
  return placeGlyphs(layout, frame, originPhasePx).flatMap((glyph) => {
    const rect = rectOf(glyph);
    return rect && drawsGlyphRect(glyphDrawer, rect.w, rect.h) ? [rect] : [];
  });
}

/**
 * One quad for each of `rects`, in run space as `buildCanvasTextQuadArrays` places the raster quad:
 * Godot px, +Y down, negated to three's Y-up. Each quad holds the place of its rectangle in the
 * raster as its UVs.
 */
export function buildCanvasGlyphQuadArrays(
  rects: readonly Rect2[],
  { canvasWidthPx, canvasHeightPx, offsetXPx, offsetYPx }: CanvasTextCanvasLayout,
  originPhasePx: Readonly<Vector2> = VECTOR2_ZERO
): CanvasTextQuadArrays {
  const positions = new Float32Array(rects.length * 4 * 3);
  const uvs = new Float32Array(rects.length * 4 * 2);
  const indices = new Uint32Array(rects.length * 6);
  rects.forEach(({ x, y, w, h }, quad) => {
    const left = x - offsetXPx - originPhasePx.x;
    const right = left + w;
    const top = y - offsetYPx - originPhasePx.y;
    const bottom = top + h;
    const vertex = quad * 4;
    // Vertex order TL, TR, BL, BR, as the raster quad.
    positions.set([left, -top, 0, right, -top, 0, left, -bottom, 0, right, -bottom, 0], vertex * 3);
    const u0 = x / canvasWidthPx;
    const u1 = (x + w) / canvasWidthPx;
    // flipY=true: v=1 at the raster's top row.
    const vTop = 1 - y / canvasHeightPx;
    const vBottom = 1 - (y + h) / canvasHeightPx;
    uvs.set([u0, vTop, u1, vTop, u0, vBottom, u1, vBottom], vertex * 2);
    indices.set([vertex + 2, vertex + 3, vertex, vertex + 3, vertex + 1, vertex], quad * 6);
  });
  return { positions, uvs, indices };
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
