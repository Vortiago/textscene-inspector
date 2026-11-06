/**
 * The canvas-2D glyph painter, `TextRunMesh.tsx`'s second path beside the MSDF atlas.
 * It serves a runtime-loaded scene font, which has no bake, and the bundled font
 * where FreeType semantics are needed, such as Label3D's stroked outline. It runs
 * for `TextLayoutResult.fontMetrics.kind === 'canvas'`.
 */
// One raster and one quad: a per-glyph atlas needs a font fetch, which the CSP forbids
// (`bake-metrics.mjs`), while canvas-2D calls pass it. Each glyph draws at the pen
// `x` `textLayout.ts` computed, so a whole-string `fillText` cannot re-shape it
// with the ligatures or kerning the measurer folded in (`runtimeFontMetrics.ts`).
import * as THREE from 'three';
import {
  fillContours,
  variedContoursReader,
  variedGlyphContoursReader,
  maxEmboldenGrowthPx,
  paintEmboldenedFill,
  shearAboutBaseline,
  strokeContours,
} from './canvasVariation';
import {
  canvasGlyphPenXPx,
  drawnOpentype,
  fontIsScaled,
  getFontAscentPx,
  isGlyphVaried,
  type FontMetrics,
  type GlyphVariation,
} from './fontMetrics';
import type { GlyphContours } from './glyphContours';
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

interface CanvasTextCanvasLayout {
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
  // The worst-case shear offset over a line's rows (`buildGlyphQuadArrays`'s
  // `dx(y) = -skew * (y - baselinePx)`): every row of the raster above the baseline. A font's
  // descent is shorter than its ascent, so the rows below shear less.
  const shearPadPx = Math.abs(skew) * (layout.baselineOffsetPx + offsetYPx);
  // Whole pixels, as Godot draws a glyph texture texel-aligned: a fractional pad puts each texel
  // between two screen pixels, and the linear filter thins every edge.
  const padXPx = Math.ceil(shearPadPx + strokePadPx + emboldenPadPx);
  const { startPx, endPx } = drawnExtentPx(layout);
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
 * The span of the ink of the glyphs, their pen boxes, the pen snap and the hinting included. Godot
 * draws each glyph quad whole wherever its side bearing reaches, which a raster of the line box
 * would clip. The run of a fallback face keeps its glyphs at their places on the line
 * (`faceLayouts.ts`), so its raster spans them alone. A layout with no glyph spans its width.
 */
function drawnExtentPx(layout: TextLayoutResult): { startPx: number; endPx: number } {
  let startPx = Infinity;
  let endPx = -Infinity;
  const inkFaces = new Map<FontMetrics, CanvasFontMetrics | null>();
  for (const { glyphs } of layout.lines) {
    for (const glyph of glyphs) {
      const face = glyph.fontMetrics;
      let inkFace = inkFaces.get(face);
      if (inkFace === undefined) inkFaces.set(face, (inkFace = drawsMeasuredInk(face) ? face : null));
      const { leftPx, rightPx } = glyphReachPx(glyph, inkFace, layout.baselineOffsetPx);
      // The ink draws `xOffset` past the pen, so its reach moves with it.
      const inkPenPx = glyph.x + (glyph.xOffset ?? 0);
      startPx = Math.min(startPx, inkPenPx - leftPx - INK_SLACK_LEFT_PX);
      endPx = Math.max(endPx, inkPenPx + rightPx + INK_SLACK_RIGHT_PX);
    }
  }
  return startPx === Infinity ? { startPx: 0, endPx: layout.widthPx } : { startPx, endPx };
}

/** Whether `face` draws the ink it measures: `measureText` measures the default instance alone. */
function drawsMeasuredInk(face: FontMetrics): face is CanvasFontMetrics {
  return isCanvasFontMetrics(face) && !drawnOpentype(face);
}

/**
 * How far `glyph`'s ink reaches left of its pen and right of it, px, its pen box included. `inkFace`
 * is its face where that face draws the ink it measures. A glyph with no such ink takes the larger
 * of `lineAscentPx` and its face's own ascent on each side: an ascent bounds the reach of any glyph.
 */
function glyphReachPx(
  glyph: GlyphPlacement,
  inkFace: CanvasFontMetrics | null,
  lineAscentPx: number
): { leftPx: number; rightPx: number } {
  const ink = inkFace?.getGlyphInkUnits?.(glyph.char);
  if (!ink) {
    const reachPx = Math.max(lineAscentPx, getFontAscentPx(glyph.fontMetrics, glyph.fontSizePx));
    return { leftPx: reachPx, rightPx: glyph.advance + reachPx };
  }
  const pxPerUnit = glyph.fontSizePx / glyph.fontMetrics.unitsPerEm;
  return {
    leftPx: Math.max(0, ink.left * pxPerUnit),
    rightPx: Math.max(glyph.advance, ink.right * pxPerUnit),
  };
}

/** The `GlyphQuadArrays` shape `buildGlyphQuadArrays` produces, always exactly one quad. */
interface CanvasTextQuadArrays {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/**
 * One quad spanning the padded raster, placed so the layout origin is at x = 0 in
 * `buildGlyphQuadArrays`'s convention (Godot px, +Y down, negated to three's Y-up). The quad
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

  // Vertex order TL, TR, BL, BR, as in buildGlyphQuadArrays.
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
 * An opaque CSS colour from a Godot sRGB colour's 0-1 channels, unconverted:
 * canvas fill colours are sRGB, and the `SRGBColorSpace` texture gets three's
 * decode. The material's `opacity` applies `tint.a` once.
 */
function opaqueCssColor(tint: Pick<Rgba, 'r' | 'g' | 'b'>): string {
  const clamp255 = (c: number) => Math.max(0, Math.min(255, Math.round(c * 255)));
  return `rgb(${clamp255(tint.r)}, ${clamp255(tint.g)}, ${clamp255(tint.b)})`;
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
 * Paints the contours of `glyph`, or of its base and marks at their offsets from the pen. The base
 * draws `xOffset` past the pen. False where no character of it has an outline, so the caller paints
 * it as text.
 */
function paintGlyphContours(
  paint: ContourPaint,
  ctx: CanvasRenderingContext2D,
  contoursOf: (char: string) => GlyphContours | null,
  glyph: GlyphPlacement,
  penX: number,
  baselineY: number
): boolean {
  const { decomposition } = glyph;
  const basePenX = penX + (glyph.xOffset ?? 0);
  const base = contoursOf(decomposition?.base ?? glyph.char);
  if (base) paint(ctx, base, basePenX, baselineY);
  let isPainted = base !== null;
  for (const { char, x, y } of decomposition?.marks ?? []) {
    const contours = contoursOf(char);
    if (contours) paint(ctx, contours, penX + x, baselineY + y);
    isPainted ||= contours !== null;
  }
  return isPainted;
}

type ContourPaint = (
  ctx: CanvasRenderingContext2D,
  contours: GlyphContours,
  penX: number,
  baselineY: number
) => void;

/** The variation of contours a sheared context draws: the context shears them. */
const UNVARIED: GlyphVariation = { embolden: 0, skew: 0 };

/**
 * Draws `layout`, shaped against a `'canvas'`-kind `FontMetrics`, glyph by glyph
 * at each `GlyphPlacement.x`.
 * `skew` shears each line's ink about its own baseline. With the `outlines` its metrics carry, the ring of
 * an emboldened, sheared or varied glyph strokes the changed contour, so a shear does not shear its
 * width, and the fill of an emboldened or varied glyph fills it.
 */
// Happy-dom has no 2D context, so under vitest the canvas stays blank. The pixels
// are a golden-image concern, so a unit test reads the calls, not the pixels.
export function paintSceneFontCanvas(
  layout: TextLayoutResult,
  fontSizePx: number,
  tint: Rgba,
  skew: number,
  canvasLayout: CanvasTextCanvasLayout,
  { strokeWidthPx = 0, glyphDrawer = 'canvasItem', originPhasePx = VECTOR2_ZERO }: CanvasTextPaintOptions = {}
): HTMLCanvasElement {
  const metrics = layout.fontMetrics;
  if (!isCanvasFontMetrics(metrics)) {
    throw new Error('paintSceneFontCanvas requires a layout shaped against a canvas-kind FontMetrics');
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasLayout.canvasWidthPx;
  canvas.height = canvasLayout.canvasHeightPx;

  // A CPU raster, as FreeType's exact-area coverage: Chromium's GPU path rasteriser thins small
  // glyphs, 2.4% of the ink at 8 px against Godot's (`textRun.md`).
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas; // happy-dom/vitest only.

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${fontSizePx}px "${metrics.cssFontFamily}"`;
  const stroked = strokeWidthPx > 0;
  if (stroked) {
    // FreeType's `FT_Glyph_Stroke` exports both borders, an annulus a centred canvas
    // stroke of the same width paints (`text_server_adv.cpp:1383-1390`).
    // `LINEJOIN_ROUND`/`LINECAP_BUTT` are that stroker's settings (`:1383`).
    ctx.strokeStyle = opaqueCssColor(tint);
    ctx.lineWidth = strokeWidthPx;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
  } else {
    ctx.fillStyle = opaqueCssColor(tint);
    // The stroke of an emboldened fill (`paintEmboldenedFill`) is the fill's colour, mitred as
    // `FT_Outline_Embolden` mitres its corners.
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineJoin = 'miter';
  }

  const baselineOffsetPx = layout.baselineOffsetPx;
  const embolden = metrics.embolden ?? 0;
  const opentype = drawnOpentype(metrics);
  const variation: GlyphVariation = { embolden, skew, opentype };
  // The ring of a varied face strokes the contours, and the fill of a face varied by more than a shear
  // fills them. They carry their own shear.
  const followsContours = isGlyphVaried(stroked ? variation : { embolden, opentype });
  const contourOutlines = followsContours ? (metrics.outlines ?? null) : null;
  const contoursOf = contourOutlines && variedContoursReader(contourOutlines, fontSizePx, variation);
  const paintContours = stroked ? strokeContours : fillContours;
  // A glyph the run shaping gives a cluster has no character to draw as text, so it draws its contours.
  const shapedContoursOf =
    metrics.outlines &&
    variedGlyphContoursReader(metrics.outlines, fontSizePx, contourOutlines ? variation : UNVARIED);
  const isShapeVaried = isGlyphVaried({ skew, opentype });

  const paintGlyphText = (char: string, penX: number, baselineY: number, growthPx: number | undefined) => {
    if (stroked) ctx.strokeText(char, penX, baselineY);
    else if (growthPx) paintEmboldenedFill(ctx, char, penX, baselineY, growthPx);
    else ctx.fillText(char, penX, baselineY);
  };

  // The line of a contour face is unsheared, so a glyph with no contour shears itself.
  const paintShearedGlyphText = (
    char: string,
    penX: number,
    baselineY: number,
    growthPx: number | undefined
  ) => {
    ctx.save();
    shearAboutBaseline(ctx, skew, baselineY);
    paintGlyphText(char, penX, baselineY, growthPx);
    ctx.restore();
  };

  // The raster starts at the whole item pixel at or before the run origin, where its quad sits.
  const snapsGlyphs = snapsGlyphsToItemPixels(glyphDrawer, fontSizePx, metrics);
  layout.lines.forEach((line, lineIndex) => {
    const lineBaselinePx = lineIndex * layout.linePitchPx + baselineOffsetPx;
    const baselineY =
      canvasLayout.offsetYPx + (snapsGlyphs ? Math.floor(originPhasePx.y + lineBaselinePx) : lineBaselinePx);

    ctx.save();
    // A contour line draws under the identity transform, so its stroke keeps its width in every direction.
    if (skew !== 0 && !contourOutlines) shearAboutBaseline(ctx, skew, baselineY);
    for (const gp of line.glyphs) {
      if (gp.char === ' ' || gp.char === '\n' || gp.char === '\r') continue;
      const penX =
        canvasLayout.offsetXPx +
        (snapsGlyphs ? canvasGlyphPenXPx(originPhasePx.x + gp.x, fontSizePx, metrics) : gp.x);
      const shapedContours = gp.glyphIndex !== undefined && shapedContoursOf?.(gp.glyphIndex);
      if (shapedContours) {
        paintContours(ctx, shapedContours, penX + (gp.xOffset ?? 0), baselineY);
        continue;
      }
      // A glyph shaped with no growth, in a layout that is not sheared or at an instance, stays on its plain ring.
      const hasVariedGlyph = gp.emboldenGrowthPx || isShapeVaried;
      const isContourPainted =
        contoursOf &&
        hasVariedGlyph &&
        paintGlyphContours(paintContours, ctx, contoursOf, gp, penX, baselineY);
      if (isContourPainted) continue;
      const textPenX = penX + (gp.xOffset ?? 0);
      if (contourOutlines && skew !== 0)
        paintShearedGlyphText(gp.char, textPenX, baselineY, gp.emboldenGrowthPx);
      else paintGlyphText(gp.char, textPenX, baselineY, gp.emboldenGrowthPx);
    }
    ctx.restore();
  });

  return canvas;
}

interface CanvasTextMaterialOptions extends Partial<SurfaceBlend> {
  map: THREE.Texture;
  /** Multiplies the raster's anti-aliasing alpha. The raster is opaque, so this is the only place `tint.a` applies. */
  opacity: number;
  /** The linear colour that multiplies the map. Omitted, white: a canvas raster has its tint baked in. A BMFont page does not. */
  color?: THREE.ColorRepresentation;
  /** `false` by default, like `createMsdfMaterial`. */
  depthTest?: boolean;
  /** Omitted, it takes `canvasItemFacing()`'s side, like `createMsdfMaterial`. */
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
