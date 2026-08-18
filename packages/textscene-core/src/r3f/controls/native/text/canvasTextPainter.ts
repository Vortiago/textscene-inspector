/**
 * The canvas-2D glyph painter — `TextRun.tsx`'s SECOND painting path,
 * alongside the vendored MSDF-atlas one
 * (`buildGlyphQuadArrays`/`msdfMaterial.ts`). Serves a scene-authored
 * (runtime-loaded) font, which has no bake at all, and the bundled font
 * wherever a consumer needs FreeType semantics the distance field cannot
 * carry — Label3D's stroked outline above all. Dispatches on
 * `TextLayoutResult.fontMetrics.kind === 'canvas'` (`fontMetrics.ts`'s
 * `FontMetricsKind`) — see `TextRun.tsx`'s own doc for where that check
 * lives.
 *
 * ## Why one raster + one quad, not one atlas-style quad per glyph
 *
 * There is no baked bitmap per character to place, and building one
 * dynamically (a runtime MSDF/SDF atlas) needs exactly the worker
 * `bake-metrics.mjs`'s own doc says this CSP forbids
 * (`worker-src`/`blob:` absent). Rasterising the WHOLE shaped layout onto
 * ONE canvas and sampling it as ONE textured quad needs nothing but
 * synchronous canvas-2D calls — the validated CSP door
 * (`sceneFontLoader.ts`'s own doc). Each glyph is drawn at the pen `x`
 * `textLayout.ts` already computed (not a second, canvas-internal shaping
 * pass via one `fillText(line.text, ...)` call) so the ink matches the SAME
 * shaping every other consumer of the layout agrees on, glyph-for-glyph —
 * see `runtimeFontMetrics.ts`'s own doc for why a canvas-internal re-shape
 * of the whole string (which could silently re-apply ligatures/kerning this
 * repo's own measurer already folded into `advance`) is the risk this
 * specific choice avoids.
 *
 * ## Padding
 *
 * The raster canvas is deliberately LARGER than `layout.widthPx x
 * layout.heightPx`: a small fixed vertical pad on every edge for
 * anti-aliased ink that overshoots a glyph's own advance/pitch box (the
 * same reason MSDF atlas cells aren't cropped tight to their glyph
 * outlines), plus — ONLY when `skew` (synthesized-italic shear) is nonzero —
 * extra horizontal pad sized to the worst-case shear offset, split evenly
 * left/right so the destination quad can stay centred on the unpadded
 * content box regardless of shear sign. `buildCanvasTextQuadArrays` is the
 * pure half of this (quad geometry only, no raster); `paintSceneFontCanvas`
 * is the DOM-touching half (draws the actual pixels) and is intentionally
 * NOT unit-tested directly for the same reason `TextRun.tsx`'s own
 * `getAtlasTexture` never has been — the pixels are a golden-image concern,
 * not a scene-graph-shape one (this repo's own `AGENTS.md`: never assert
 * rendered geometry under happy-dom, which has no `CanvasRenderingContext2D`
 * at all — `getContext('2d')` returns `null` — so `paintSceneFontCanvas`
 * guards every draw call behind a null check and simply produces a blank
 * texture in that environment; a real browser always has a 2D context).
 */
import * as THREE from 'three';
import type { TextLayoutResult } from './textLayout';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import type { Color } from '../../../../nodes/base/node2d/types';
import { canvasItemFacing } from '../../../canvasItemFacing';

/** Raster supersampling factor — canvas text has no distance field to stay crisp under magnification (unlike the MSDF path), so this trades memory/fill-rate for sharpness at the zoom levels this previewer's viewport typically sits at. Not adaptive: a fixed, documented quality/perf tradeoff, not a per-frame recompute. */
export const CANVAS_TEXT_SUPERSAMPLE = 3;

/** Fixed vertical pad, CSS px (pre-supersample), on every raster edge — anti-aliased ink can overshoot a glyph's own ascent/descent box by a pixel or two; cropping tight would clip it. Exported because it is part of the quad's own contract: the destination quad is this much TALLER than `layout.heightPx`, on both edges. */
export const CANVAS_TEXT_VERTICAL_PAD_PX = 4;

/**
 * The whole supersampled device pixels a CSS-px extent needs. The quad
 * samples the WHOLE canvas across its own extent, so a canvas allocated
 * larger than what the quad spans stretches the raster by the rounding
 * residual — and two surfaces of the same layout with DIFFERENT padding
 * (Label3D's stroked outline and its fill) then land their ink at different
 * places. Rounding ONCE, here, and having both halves read the result is
 * what keeps the content box at the quad origin for every padding.
 */
function wholeDevicePx(cssPx: number): number {
  return Math.max(1, Math.ceil(cssPx * CANVAS_TEXT_SUPERSAMPLE));
}

export interface CanvasTextCanvasLayout {
  /** Raster canvas width, CSS px (pre-supersample) — `layout.widthPx` plus twice `offsetXPx`, rounded up to a whole device pixel. */
  canvasWidthPx: number;
  /** Raster canvas height, CSS px (pre-supersample) — `layout.heightPx` plus twice `offsetYPx`, rounded up to a whole device pixel. */
  canvasHeightPx: number;
  /** Left padding, CSS px — where the UNPADDED content box (x=0 in `layout`'s own coordinate space) sits within the raster canvas. Half of the total horizontal pad (shear reach plus any outline-stroke reach); the same amount is mirrored on the right. */
  offsetXPx: number;
  /** Top padding, CSS px — `CANVAS_TEXT_VERTICAL_PAD_PX` plus any outline-stroke reach. */
  offsetYPx: number;
  /** `HTMLCanvasElement#width` — whole supersampled device pixels, rounded here so the painter never re-rounds `canvasWidthPx` to a different answer. */
  deviceWidthPx: number;
  /** `HTMLCanvasElement#height`, likewise. */
  deviceHeightPx: number;
}

/**
 * Sizes the raster canvas for `layout` at a given synthesized-italic `skew`
 * coefficient (`TextRun.tsx`'s own `skew` prop; 0 = upright) and outline
 * stroke width (`paintSceneFontCanvas`'s own `strokeWidthPx`; 0 = filled).
 * Pure — no canvas/DOM touched.
 */
export function computeCanvasTextCanvasLayout(
  layout: TextLayoutResult,
  skew: number,
  strokeWidthPx = 0
): CanvasTextCanvasLayout {
  // Worst-case horizontal displacement a shear this steep introduces over
  // the full line-pitch height (buildGlyphQuadArrays's own `dx(y) = -skew *
  // (y - baselinePx)` — the largest |y - baselinePx| within one line is
  // bounded by `linePitchPx`, so this over-estimates slightly for a single
  // line and is exact for the tallest case; a small over-pad costs nothing
  // but idle canvas pixels).
  const shearPadPx = Math.abs(skew) * layout.linePitchPx;
  // A CENTRED stroke reaches half its width outside the glyph contour, on
  // every side — including horizontally, where an upright fill needs no pad
  // at all and the outermost glyph would otherwise be cut at the canvas edge.
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

/** Same `GlyphQuadArrays` shape `TextRun.tsx`'s `buildGlyphQuadArrays` produces (`positions`/`uvs`/`indices`), always exactly one quad. */
export interface CanvasTextQuadArrays {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/**
 * ONE quad spanning the padded raster canvas, positioned so the UNPADDED
 * content box aligns with `[0, layout.widthPx] x [0, layout.heightPx]` in
 * the same Godot-px (+Y down, negated to three-local Y-up) convention
 * `buildGlyphQuadArrays` uses — a neighbouring run (an MSDF one, or another
 * canvas one) laid out against `layout.widthPx`/`.heightPx` lines up with
 * this quad's content exactly as if the padding did not exist.
 */
export function buildCanvasTextQuadArrays(canvasLayout: CanvasTextCanvasLayout): CanvasTextQuadArrays {
  const left = -canvasLayout.offsetXPx;
  // The whole canvas, not `layout.widthPx + offsetXPx` — the device-pixel
  // rounding's slack sits on this edge, and the quad must span it or the
  // raster samples stretched.
  const right = canvasLayout.canvasWidthPx - canvasLayout.offsetXPx;
  const top = -canvasLayout.offsetYPx;
  const bottom = canvasLayout.canvasHeightPx - canvasLayout.offsetYPx;

  // Vertex order TL, TR, BL, BR — same convention as buildGlyphQuadArrays.
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

/** `rgba(r,g,b,1)` from a Godot sRGB colour's own 0-1 channels — canvas 2D fill colours are sRGB natively, so this is used UNCONVERTED (contrast `msdfMaterial.ts`'s manual `sRGBToLinearRGB`, needed only because a custom `ShaderMaterial` uniform gets no automatic colourspace decode; `createCanvasTextMaterial`'s texture, marked `SRGBColorSpace`, gets that decode from three's own render pipeline instead — see this module's own doc). Alpha is deliberately fixed at 1: `tint.a` is applied once, uniformly, via the MATERIAL's `opacity` (matching `createMsdfMaterial`'s own uOpacity), not doubled into the raster too. */
function opaqueCssColor(tint: Pick<Color, 'r' | 'g' | 'b'>): string {
  const clamp255 = (c: number) => Math.max(0, Math.min(255, Math.round(c * 255)));
  return `rgb(${clamp255(tint.r)}, ${clamp255(tint.g)}, ${clamp255(tint.b)})`;
}

/**
 * Draws `layout` (already shaped against a `'canvas'`-kind `FontMetrics`) to
 * a fresh `HTMLCanvasElement` sized by `canvasLayout`, glyph-by-glyph at
 * each `GlyphPlacement.x` (this module's own doc has why not one
 * `fillText(line.text, ...)` call). A positive `strokeWidthPx` paints the
 * glyph OUTLINE ring instead of the fill — Godot's own separate outline
 * surface (`label_3d.cpp:610-615`), never a stroke layered under a fill in
 * the same raster. `skew` shears each LINE's own content
 * around ITS OWN baseline (`lineTopPx + layout.baselineOffsetPx`) via a
 * canvas transform reset per line — equivalent to `buildGlyphQuadArrays`'s
 * per-vertex shear, but applied to the raster pixels instead of the quad
 * geometry (the destination quad itself, `buildCanvasTextQuadArrays`, stays
 * axis-aligned; only the ink is sheared).
 *
 * No-ops (leaves the canvas blank) when this environment's canvas has no 2D
 * context (happy-dom under vitest — this module's own doc has why that is
 * an accepted, environment-only gap, never reachable in a real browser).
 */
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
  if (!ctx) return canvas; // happy-dom/vitest only — see this function's own doc.

  ctx.scale(CANVAS_TEXT_SUPERSAMPLE, CANVAS_TEXT_SUPERSAMPLE);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${fontSizePx}px "${metrics.cssFontFamily}"`;
  const stroked = strokeWidthPx > 0;
  if (stroked) {
    // FreeType's `FT_Glyph_Stroke` exports BOTH borders, so the outline
    // bitmap is an annulus with a transparent interior — what a centred
    // canvas stroke of the same total width paints
    // (`text_server_adv.cpp:1376-1403`). `LINEJOIN_ROUND`/`LINECAP_BUTT` are
    // that stroker's own settings (`:1383`).
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
      // x' = x - skew * (y - baselineY), y' = y — same shear this engine's
      // MSDF path applies per-vertex (TextRun.tsx's own `dx`), composed onto
      // the current (already-supersampled) transform.
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

export interface CanvasTextMaterialOptions {
  map: THREE.Texture;
  /** Combined with the raster's own per-pixel (anti-aliasing) alpha — the raster itself is drawn fully opaque (`opaqueCssColor`'s own doc), so this is the ONLY place `tint.a` is applied. */
  opacity: number;
  /** `false` (default) — matches `createMsdfMaterial`'s own default and reasoning. */
  depthTest?: boolean;
  /** Omitted (default) takes `canvasItemFacing()`'s side — matches `createMsdfMaterial`'s own default. */
  side?: THREE.Side;
  clippingPlanes?: readonly THREE.Plane[];
}

/**
 * `map_fragment.glsl.js`'s own video-texture decode define — the pairing
 * `createCanvasTextMaterial` would need if `map` were ever tagged
 * `NoColorSpace` the way every OTHER 2D-canvas-drawn texture is
 * (`canvas2DTextureDecode.ts`'s `useCanvasDecodeDefines`). `TextRun.tsx`'s
 * own doc has why THIS texture stays `SRGBColorSpace` instead (measured, not
 * inferred: Godot's own glyph rendering has no genuinely-differing RGB pair
 * for a filter to blend in the wrong order in the first place, so there is
 * nothing here for this define to correct today) — this define exists so
 * that IF that ever changes, the decode is a `map.colorSpace` check away
 * rather than a second thing to remember. Duplicated from
 * `canvas2DTextureDecode.ts` (not imported) because that module is a *hook*
 * (`useMemo`-based) and this material is built imperatively, outside any
 * component's render.
 */
const DECODE_VIDEO_TEXTURE_DEFINES: Readonly<Record<string, string>> = { DECODE_VIDEO_TEXTURE: '' };

/**
 * A plain textured quad material for canvas-rasterised text — no custom
 * shader needed (unlike MSDF: there is no distance field to decode), so
 * `THREE.MeshBasicMaterial` is used directly and gets three's OWN automatic
 * sRGB->linear hardware decode for the common case (`map` tagged
 * `SRGBColorSpace`, `TextRun.tsx`'s own doc has why that is correct for this
 * texture today). The `NoColorSpace` branch below exists so a FUTURE `map`
 * that legitimately needs the post-filter decode instead (the general
 * 2D-canvas rule every OTHER canvas-drawn texture follows) gets it
 * automatically from its OWN tag — the same auto-detection
 * `useCanvasDecodeDefines`/`ControlQuad` already do — rather than needing a
 * second, easy-to-forget edit here. The two halves (tag + define) can
 * therefore never be applied independently, whichever this function's
 * caller chooses.
 *
 * `defines` is assigned AFTER construction, not through the constructor's
 * options object: `THREE.Material#setValues` (which the constructor calls)
 * skips — with a console warning — any key that is not ALREADY a property on
 * the instance, and `MeshBasicMaterial` (unlike `ShaderMaterial`) declares no
 * default `defines` property. `WebGLProgram` itself reads `material.defines`
 * generically for every material type, so a direct assignment still reaches
 * the compiled shader; only the constructor-object shortcut does not.
 */
export function createCanvasTextMaterial(options: CanvasTextMaterialOptions): THREE.MeshBasicMaterial {
  const { map, opacity, depthTest = false, side, clippingPlanes = [] } = options;
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest,
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
