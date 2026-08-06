/**
 * The canvas-2D painter for a scene-authored (runtime-loaded) font —
 * `TextRun.tsx`'s SECOND glyph-painting path, alongside the vendored
 * MSDF-atlas one (`buildGlyphQuadArrays`/`msdfMaterial.ts`). Dispatches on
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

/** Raster supersampling factor — canvas text has no distance field to stay crisp under magnification (unlike the MSDF path), so this trades memory/fill-rate for sharpness at the zoom levels this previewer's viewport typically sits at. Not adaptive: a fixed, documented quality/perf tradeoff, not a per-frame recompute. */
export const CANVAS_TEXT_SUPERSAMPLE = 3;

/** Fixed vertical pad, CSS px (pre-supersample), on every raster edge — anti-aliased ink can overshoot a glyph's own ascent/descent box by a pixel or two; cropping tight would clip it. */
const VERTICAL_PAD_PX = 4;

export interface CanvasTextCanvasLayout {
  /** Raster canvas width, CSS px (pre-supersample) — `layout.widthPx` plus horizontal shear padding. */
  canvasWidthPx: number;
  /** Raster canvas height, CSS px (pre-supersample) — `layout.heightPx` plus `2 * VERTICAL_PAD_PX`. */
  canvasHeightPx: number;
  /** Left padding, CSS px — where the UNPADDED content box (x=0 in `layout`'s own coordinate space) sits within the raster canvas. Half of the total horizontal pad; the same amount is mirrored on the right. */
  offsetXPx: number;
  /** Top padding, CSS px — always `VERTICAL_PAD_PX`. */
  offsetYPx: number;
}

/**
 * Sizes the raster canvas for `layout` at a given synthesized-italic `skew`
 * coefficient (`TextRun.tsx`'s own `skew` prop; 0 = upright). Pure — no
 * canvas/DOM touched.
 */
export function computeCanvasTextCanvasLayout(layout: TextLayoutResult, skew: number): CanvasTextCanvasLayout {
  // Worst-case horizontal displacement a shear this steep introduces over
  // the full line-pitch height (buildGlyphQuadArrays's own `dx(y) = -skew *
  // (y - baselinePx)` — the largest |y - baselinePx| within one line is
  // bounded by `linePitchPx`, so this over-estimates slightly for a single
  // line and is exact for the tallest case; a small over-pad costs nothing
  // but idle canvas pixels).
  const shearPadPx = Math.abs(skew) * layout.linePitchPx;
  return {
    canvasWidthPx: layout.widthPx + 2 * shearPadPx,
    canvasHeightPx: layout.heightPx + 2 * VERTICAL_PAD_PX,
    offsetXPx: shearPadPx,
    offsetYPx: VERTICAL_PAD_PX,
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
export function buildCanvasTextQuadArrays(
  layout: TextLayoutResult,
  canvasLayout: CanvasTextCanvasLayout
): CanvasTextQuadArrays {
  const left = -canvasLayout.offsetXPx;
  const right = layout.widthPx + canvasLayout.offsetXPx;
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
 * `fillText(line.text, ...)` call). `skew` shears each LINE's own content
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
  canvasLayout: CanvasTextCanvasLayout
): HTMLCanvasElement {
  const metrics = layout.fontMetrics;
  if (!isCanvasFontMetrics(metrics)) {
    throw new Error('paintSceneFontCanvas requires a layout shaped against a canvas-kind FontMetrics');
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(canvasLayout.canvasWidthPx * CANVAS_TEXT_SUPERSAMPLE));
  canvas.height = Math.max(1, Math.ceil(canvasLayout.canvasHeightPx * CANVAS_TEXT_SUPERSAMPLE));

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas; // happy-dom/vitest only — see this function's own doc.

  ctx.scale(CANVAS_TEXT_SUPERSAMPLE, CANVAS_TEXT_SUPERSAMPLE);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${fontSizePx}px "${metrics.cssFontFamily}"`;
  ctx.fillStyle = opaqueCssColor(tint);

  const baselineOffsetPx = layout.baselineOffsetPx ?? 0;

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
      ctx.fillText(gp.char, canvasLayout.offsetXPx + gp.x, baselineY);
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
  /** `THREE.DoubleSide` (default) — matches `createMsdfMaterial`'s own default. */
  side?: THREE.Side;
  clippingPlanes?: readonly THREE.Plane[];
}

/**
 * A plain textured quad material for canvas-rasterised text — no custom
 * shader needed (unlike MSDF: there is no distance field to decode), so
 * `THREE.MeshBasicMaterial` is used directly and gets three's OWN automatic
 * sRGB->linear texture decode for free (the texture must be marked
 * `THREE.SRGBColorSpace`, done by the caller when constructing the
 * `THREE.CanvasTexture` — `msdfMaterial.ts`'s own doc has why a hand-written
 * `ShaderMaterial`, unlike this built-in one, would need that decode spelled
 * out by hand instead).
 */
export function createCanvasTextMaterial(options: CanvasTextMaterialOptions): THREE.MeshBasicMaterial {
  const { map, opacity, depthTest = false, side = THREE.DoubleSide, clippingPlanes = [] } = options;
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest,
    side,
    clippingPlanes: [...clippingPlanes],
  });
}
