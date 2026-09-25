/**
 * The canvas-2D glyph painter, `TextRun.tsx`'s second path beside the MSDF atlas.
 * It serves a runtime-loaded scene font, which has no bake, and the bundled font
 * where FreeType semantics are needed, such as Label3D's stroked outline. It runs
 * for `TextLayoutResult.fontMetrics.kind === 'canvas'`.
 */
// One raster and one quad: a per-glyph atlas needs a worker, which the CSP forbids
// (`bake-metrics.mjs`), while canvas-2D calls pass it. Each glyph draws at the pen
// `x` `textLayout.ts` computed, so a whole-string `fillText` cannot re-shape it
// with the ligatures or kerning the measurer folded in (`runtimeFontMetrics.ts`).
import * as THREE from 'three';
import type { TextLayoutResult } from './textLayout';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import type { Color } from '../../../../nodes/base/node2d/types';
import { canvasItemFacing } from '../../../canvasItemFacing';

/** Fixed raster supersampling factor: canvas text has no distance field to stay crisp when magnified, so this trades memory and fill rate for sharpness at typical zoom. */
export const CANVAS_TEXT_SUPERSAMPLE = 3;

/** Fixed vertical pad, CSS px before supersampling, on every raster edge: anti-aliased ink can overshoot a glyph's ascent/descent box. The quad is this much taller than `layout.heightPx` on both edges. */
export const CANVAS_TEXT_VERTICAL_PAD_PX = 4;

/**
 * The whole supersampled device pixels a CSS-px extent needs. The quad samples
 * the whole canvas, so rounding once, here, for both halves keeps the content box
 * at the quad origin for every padding, and Label3D's outline and fill line up.
 */
function wholeDevicePx(cssPx: number): number {
  return Math.max(1, Math.ceil(cssPx * CANVAS_TEXT_SUPERSAMPLE));
}

export interface CanvasTextCanvasLayout {
  /** Raster canvas width, CSS px before supersampling: `layout.widthPx` plus twice `offsetXPx`, rounded up to a whole device pixel. */
  canvasWidthPx: number;
  /** Raster canvas height, CSS px before supersampling: `layout.heightPx` plus twice `offsetYPx`, rounded up to a whole device pixel. */
  canvasHeightPx: number;
  /** Left padding, CSS px: where the unpadded content box (x=0 in `layout`) sits in the raster. Shear reach plus stroke reach, mirrored on the right. */
  offsetXPx: number;
  /** Top padding, CSS px: `CANVAS_TEXT_VERTICAL_PAD_PX` plus any outline-stroke reach. */
  offsetYPx: number;
  /** `HTMLCanvasElement#width` in whole supersampled device pixels, rounded here so the painter never re-rounds `canvasWidthPx` differently. */
  deviceWidthPx: number;
  /** `HTMLCanvasElement#height`, likewise. */
  deviceHeightPx: number;
}

/**
 * Sizes the raster canvas for `layout` at a synthesised-italic `skew` (0 is
 * upright) and outline `strokeWidthPx` (0 is filled). The horizontal pad is
 * split evenly, so the quad stays centred on the content box. Pure: no DOM.
 */
export function computeCanvasTextCanvasLayout(
  layout: TextLayoutResult,
  skew: number,
  strokeWidthPx = 0
): CanvasTextCanvasLayout {
  // The worst-case shear offset over one line pitch (`buildGlyphQuadArrays`'s
  // `dx(y) = -skew * (y - baselinePx)`). It over-pads a little, which costs
  // only idle canvas pixels.
  const shearPadPx = Math.abs(skew) * layout.linePitchPx;
  // A centred stroke reaches half its width outside the contour on every side,
  // horizontally too, where an upright fill needs no pad.
  const strokePadPx = strokeWidthPx / 2;
  const offsetXPx = shearPadPx + strokePadPx;
  const offsetYPx = CANVAS_TEXT_VERTICAL_PAD_PX + strokePadPx;
  const deviceWidthPx = wholeDevicePx(layout.widthPx + 2 * offsetXPx);
  const deviceHeightPx = wholeDevicePx(layout.heightPx + 2 * offsetYPx);
  return {
    canvasWidthPx: deviceWidthPx / CANVAS_TEXT_SUPERSAMPLE,
    canvasHeightPx: deviceHeightPx / CANVAS_TEXT_SUPERSAMPLE,
    offsetXPx,
    offsetYPx,
    deviceWidthPx,
    deviceHeightPx,
  };
}

/** The `GlyphQuadArrays` shape `buildGlyphQuadArrays` produces, always exactly one quad. */
export interface CanvasTextQuadArrays {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/**
 * One quad spanning the padded raster, placed so the unpadded content box is
 * `[0, layout.widthPx] x [0, layout.heightPx]` in `buildGlyphQuadArrays`'s
 * convention (Godot px, +Y down, negated to three's Y-up). A neighbouring run
 * lines up as if the padding did not exist.
 */
export function buildCanvasTextQuadArrays(canvasLayout: CanvasTextCanvasLayout): CanvasTextQuadArrays {
  const left = -canvasLayout.offsetXPx;
  // The whole canvas, not `layout.widthPx + offsetXPx`: the rounding slack sits
  // on this edge, and the quad must span it or the raster samples stretched.
  const right = canvasLayout.canvasWidthPx - canvasLayout.offsetXPx;
  const top = -canvasLayout.offsetYPx;
  const bottom = canvasLayout.canvasHeightPx - canvasLayout.offsetYPx;

  // Vertex order TL, TR, BL, BR, as in buildGlyphQuadArrays.
  const positions = new Float32Array([
    left,
    -top,
    0,
    right,
    -top,
    0,
    left,
    -bottom,
    0,
    right,
    -bottom,
    0,
  ]);
  // flipY=true: v=1 at the texture's own top row (image-space y=0).
  const uvs = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
  const indices = new Uint32Array([2, 3, 0, 3, 1, 0]);
  return { positions, uvs, indices };
}

/**
 * An opaque CSS colour from a Godot sRGB colour's 0-1 channels, unconverted:
 * canvas fill colours are sRGB, and the `SRGBColorSpace` texture gets three's
 * decode. The material's `opacity` applies `tint.a` once.
 */
function opaqueCssColor(tint: Pick<Color, 'r' | 'g' | 'b'>): string {
  const clamp255 = (c: number) => Math.max(0, Math.min(255, Math.round(c * 255)));
  return `rgb(${clamp255(tint.r)}, ${clamp255(tint.g)}, ${clamp255(tint.b)})`;
}

/**
 * Draws `layout`, shaped against a `'canvas'`-kind `FontMetrics`, glyph by glyph
 * at each `GlyphPlacement.x`. A positive `strokeWidthPx` paints the outline ring
 * instead of the fill, as Godot's separate outline surface (`label_3d.cpp:610-615`).
 * `skew` shears each line's ink about its own baseline. The quad stays axis-aligned.
 */
// Happy-dom has no 2D context, so under vitest the canvas stays blank. The pixels
// are a golden-image concern, so no unit test reads them.
export function paintSceneFontCanvas(
  layout: TextLayoutResult,
  fontSizePx: number,
  tint: Color,
  skew: number,
  canvasLayout: CanvasTextCanvasLayout,
  strokeWidthPx = 0
): HTMLCanvasElement {
  const metrics = layout.fontMetrics;
  if (!isCanvasFontMetrics(metrics)) {
    throw new Error('paintSceneFontCanvas requires a layout shaped against a canvas-kind FontMetrics');
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasLayout.deviceWidthPx;
  canvas.height = canvasLayout.deviceHeightPx;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas; // happy-dom/vitest only.

  ctx.scale(CANVAS_TEXT_SUPERSAMPLE, CANVAS_TEXT_SUPERSAMPLE);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${fontSizePx}px "${metrics.cssFontFamily}"`;
  const stroked = strokeWidthPx > 0;
  if (stroked) {
    // FreeType's `FT_Glyph_Stroke` exports both borders, an annulus a centred canvas
    // stroke of the same width paints (`text_server_adv.cpp:1376-1403`).
    // `LINEJOIN_ROUND`/`LINECAP_BUTT` are that stroker's settings (`:1383`).
    ctx.strokeStyle = opaqueCssColor(tint);
    ctx.lineWidth = strokeWidthPx;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
  } else {
    ctx.fillStyle = opaqueCssColor(tint);
  }

  const baselineOffsetPx = layout.baselineOffsetPx;

  layout.lines.forEach((line, lineIndex) => {
    const lineTopPx = lineIndex * layout.linePitchPx;
    const baselineY = canvasLayout.offsetYPx + lineTopPx + baselineOffsetPx;

    ctx.save();
    if (skew !== 0) {
      // x' = x - skew * (y - baselineY), y' = y: the MSDF path's per-vertex
      // shear (TextRun.tsx's `dx`), composed onto the supersampled transform.
      ctx.transform(1, 0, -skew, 1, skew * baselineY, 0);
    }
    for (const gp of line.glyphs) {
      if (gp.char === ' ' || gp.char === '\n' || gp.char === '\r') continue;
      if (stroked) ctx.strokeText(gp.char, canvasLayout.offsetXPx + gp.x, baselineY);
      else ctx.fillText(gp.char, canvasLayout.offsetXPx + gp.x, baselineY);
    }
    ctx.restore();
  });

  return canvas;
}

/**
 * One `BaseMaterial3D::Transparency` (`material.h:200-207`) in three's terms: what
 * a 3D text surface's `alpha_cut` selects (`label_3d.cpp:386-393`). A 2D Control
 * always paints `TRANSPARENCY_ALPHA`, every field's default below.
 */
export interface CanvasTextTransparency {
  transparent: boolean;
  depthWrite: boolean;
  alphaTest: number;
  alphaHash: boolean;
}

export interface CanvasTextMaterialOptions extends Partial<CanvasTextTransparency> {
  map: THREE.Texture;
  /** Multiplies the raster's anti-aliasing alpha. The raster is opaque, so this is the only place `tint.a` applies. */
  opacity: number;
  /** `false` by default, like `createMsdfMaterial`. */
  depthTest?: boolean;
  /** Omitted, it takes `canvasItemFacing()`'s side, like `createMsdfMaterial`. */
  side?: THREE.Side;
  clippingPlanes?: readonly THREE.Plane[];
}

/**
 * `map_fragment.glsl.js`'s video-texture decode define, for a `map` tagged
 * `NoColorSpace` like other 2D-canvas textures (`canvas2DTextureDecode.ts`'s
 * `useCanvasDecodeDefines`). Copied, not imported: that module is a hook, and
 * this material is built outside render.
 */
// This texture stays `SRGBColorSpace` (`TextRun.tsx`): Godot's glyphs have no
// differing RGB pair for a filter to blend in the wrong order, as measured.
const DECODE_VIDEO_TEXTURE_DEFINES: Readonly<Record<string, string>> = { DECODE_VIDEO_TEXTURE: '' };

/**
 * A `MeshBasicMaterial` for canvas-rasterised text, with three's sRGB decode for
 * an `SRGBColorSpace` map. A `NoColorSpace` map gets the post-filter decode
 * define from its own tag, as `useCanvasDecodeDefines` does, so the tag and the
 * define never apply apart.
 */
// `defines` is assigned after construction: `Material#setValues` skips, with a
// warning, a key not already on the instance, and `MeshBasicMaterial` declares no
// `defines`. `WebGLProgram` reads `material.defines` for every material type.
export function createCanvasTextMaterial(options: CanvasTextMaterialOptions): THREE.MeshBasicMaterial {
  const {
    map,
    opacity,
    depthTest = false,
    side,
    clippingPlanes = [],
    transparent = true,
    depthWrite = false,
    alphaTest = 0,
    alphaHash = false,
  } = options;
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent,
    opacity,
    depthWrite,
    depthTest,
    alphaTest,
    alphaHash,
    // Unlike `defines` below, `forceSinglePass` IS a property `THREE.Material`'s
    // constructor declares, so `setValues` assigns it from this object.
    ...canvasItemFacing(side),
    clippingPlanes: [...clippingPlanes],
  });
  if (map.colorSpace === THREE.NoColorSpace) {
    material.defines = { ...DECODE_VIDEO_TEXTURE_DEFINES };
  }
  return material;
}
