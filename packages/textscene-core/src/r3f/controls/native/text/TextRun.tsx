/**
 * Merged glyph quads for one `shapeText` layout — every visible glyph across
 * every line as a SINGLE `THREE.BufferGeometry` + material.
 *
 * ## Internal dispatch: MSDF atlas vs. canvas-rasterised
 *
 * `<TextRun>` is the ONE entry point every text-painting Control
 * (`label`/`button`/`lineedit`/`richtextlabel`/…) imports; none of them
 * branch on which font a node resolved, so this component does, reading
 * `layout.fontMetrics.kind` (`fontMetrics.ts`'s `FontMetricsKind` — the
 * SAME field `textLayout.ts`'s `shapeText` already echoes back for every
 * layout, atlas or not):
 *   - `'atlas'` (default, `OPEN_SANS_FONT_METRICS`) — `buildGlyphQuadArrays`
 *     below, sampled from the vendored Open Sans MSDF atlas, unchanged from
 *     before a second `FontMetrics` kind existed.
 *   - `'canvas'` (`runtimeFontMetrics.ts`'s `CanvasFontMetrics` — a
 *     scene-authored font with no baked atlas, and the BUNDLED font when a
 *     consumer needs FreeType semantics an MSDF field cannot carry, which is
 *     every Label3D) — `canvasTextPainter.ts`'s
 *     `buildCanvasTextQuadArrays`/`paintSceneFontCanvas`, ONE textured quad
 *     rasterised through canvas-2D instead of many atlas-sampled ones (that
 *     module's own doc has the full reasoning and the CSP constraint that
 *     rules out a runtime MSDF atlas).
 * Adding a scene font therefore touches no per-slice `Component.tsx`: a
 * widget passes `layout`/`fontSizePx`/`tint` exactly as it always has, and
 * whichever `FontMetrics` `shapeText` shaped against decides the painter.
 *
 * ## MSDF atlas geometry
 *
 * Geometry lives in Godot pixels, +Y down, then negates Y once per vertex to
 * land in three-local (Y-up) space — the same convention
 * `resources/tileset/tileGeometry.ts` uses for its own batched quads, applied
 * independently here since this is a sibling leaf-drawing component, not a
 * shared dependency of it.
 *
 * Line vertical placement uses `layout.linePitchPx` (Godot's own ceiling-
 * rounded ascent+descent+spacing) as each line's top, and anchors that line
 * at ITS BASELINE, `layout.baselineOffsetPx` below the top — Godot's own
 * convention (`ofs.y += asc` before drawing, `scene/gui/label.cpp:616,823`;
 * `Button::_notification`'s `text_buf->draw(...)` goes through the identical
 * TextServer paragraph convention). The MSDF bake measures each glyph's own
 * `yoffset` from a DIFFERENT reference — its bake-time line top, with
 * `OPEN_SANS_ATLAS_INFO.base` between that and the baseline — so
 * `buildGlyphQuadArrays` reconciles the two itself. Both painters therefore
 * take a line's box-top Y and nothing else, and neither leaks its own
 * anchor to a caller (`canvasTextPainter.ts` keys off the same
 * `layout.baselineOffsetPx`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OPEN_SANS_ATLAS_INFO, OPEN_SANS_ATLAS_PNG_DATA_URL } from './openSansAtlas';
import { createMsdfMaterial } from './msdfMaterial';
import {
  computeCanvasTextCanvasLayout,
  buildCanvasTextQuadArrays,
  paintSceneFontCanvas,
  createCanvasTextMaterial,
} from './canvasTextPainter';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import type { TextLayoutResult } from './textLayout';
import type { Color } from '../../../../nodes/base/node2d/types';
import { sRGBToLinearRGB } from '../../../../utils/colorSpace';

export interface GlyphQuadArrays {
  /** `Float32Array`, 3 components/vertex, 4 vertices/glyph, order TL/TR/BL/BR. */
  positions: Float32Array;
  /** `Float32Array`, 2 components/vertex, same vertex order as `positions`. */
  uvs: Float32Array;
  /** `Uint32Array`, 6 indices/glyph (two triangles). */
  indices: Uint32Array;
}

/** Atlas pixel rect (image-Y top-left, bake-size px) -> UV rect, flipY=true convention. */
function atlasUv(x: number, y: number, width: number, height: number) {
  const { scaleW, scaleH } = OPEN_SANS_ATLAS_INFO;
  return {
    u0: x / scaleW,
    u1: (x + width) / scaleW,
    vTop: 1 - y / scaleH,
    vBottom: 1 - (y + height) / scaleH,
  };
}

/**
 * Builds one merged quad set for `layout`, skipping any placement with no
 * atlas bitmap (whitespace, or a character outside the baked charset).
 *
 * Each line is anchored at its BASELINE, `layout.baselineOffsetPx` below the
 * line's own box top (this module's own doc has the citation) — the atlas's
 * bake anchor (`OPEN_SANS_ATLAS_INFO.base` above that baseline, which every
 * glyph's `yoffset` is measured down from) is reconciled here rather than
 * handed to a caller to add back. A consumer therefore positions a line by
 * its box-top Y alone, identically for either painter.
 *
 * `skew` shears each vertex around the line's BASELINE, not its top edge:
 * Godot applies its synthesized-italic `Transform2D` via FreeType's
 * `FT_Outline_Transform` (`modules/text_server_adv/text_server_adv.cpp:
 * 1318-1320`, `:3621-3623`) directly on the glyph outline `FT_Load_Glyph`
 * just loaded — that outline's own coordinate origin is the glyph's baseline
 * pen position, so the shear pivots there (every glyph on a line shares the
 * same baseline Y, so "pivot at the glyph's own origin" and "pivot at the
 * line's baseline" are the same transform). Pivoting at the line's TOP edge
 * instead (as this used to) shifts an ascender-height vertex LEFT rather than
 * right, and shifts even a baseline-touching vertex left by a whole line's
 * worth of height — for a styled run mid-paragraph (RichTextLabel's `[i]`),
 * that eats into the space that precedes the run and opens a gap that
 * shouldn't exist after it, without changing any glyph's own pen `x`.
 */
export function buildGlyphQuadArrays(
  layout: TextLayoutResult,
  fontSizePx: number,
  skew = 0
): GlyphQuadArrays {
  const scale = fontSizePx / OPEN_SANS_ATLAS_INFO.fontSize;
  const baselineOffsetPx = layout.baselineOffsetPx;
  // How far the bake's own line-top reference (what every `glyph.yoffset` is
  // measured down from) sits above the baseline, at the TARGET size.
  //
  // A run whose OWN `fontSizePx` differs from the size that set the line's
  // shared `baselineOffsetPx` (a bbcode span at a fallback size, on a line
  // otherwise dominated by a larger one) reads a few tenths of a pixel low
  // against Godot — measured and NOT fixable here: swapping this proportional
  // scale for a per-size whole-pixel ascent ceiling regresses the case where
  // the run's own size EQUALS the line's (verified exact against Godot, by
  // the pixel, on this same measurement) by most of a pixel, and three
  // glyphs on ONE mismatched run measure three DIFFERENT residuals — no
  // single per-run constant fits all three. That is the signature of
  // Godot's own FreeType light hinting (`scene/theme/default_theme.h`'s
  // default `font_hinting`) snapping each outline's baseline/x-height/
  // cap-height/ascender independently at every requested pixel size, which a
  // continuous rescale of one MSDF bake cannot reproduce. Do not re-attempt
  // a closed-form fix here without porting that hinter — see the
  // richtextlabel node's own comparison sheet for the full measurement.
  const bakeAnchorPx = OPEN_SANS_ATLAS_INFO.base * scale;

  let glyphCount = 0;
  for (const line of layout.lines) {
    for (const gp of line.glyphs) {
      if (gp.glyph && gp.glyph.width > 0 && gp.glyph.height > 0) glyphCount++;
    }
  }

  const positions = new Float32Array(glyphCount * 4 * 3);
  const uvs = new Float32Array(glyphCount * 4 * 2);
  const indices = new Uint32Array(glyphCount * 6);

  let quad = 0;
  layout.lines.forEach((line, lineIndex) => {
    const lineTopPx = lineIndex * layout.linePitchPx;
    const baselinePx = lineTopPx + baselineOffsetPx;
    for (const gp of line.glyphs) {
      const glyph = gp.glyph;
      if (!glyph || glyph.width <= 0 || glyph.height <= 0) continue;

      const leftPx = gp.x + glyph.xoffset * scale;
      const topPx = baselinePx - bakeAnchorPx + glyph.yoffset * scale;
      const rightPx = leftPx + glyph.width * scale;
      const bottomPx = topPx + glyph.height * scale;

      const dx = (yPx: number): number => -skew * (yPx - baselinePx);
      const tl: [number, number] = [leftPx + dx(topPx), topPx];
      const tr: [number, number] = [rightPx + dx(topPx), topPx];
      const bl: [number, number] = [leftPx + dx(bottomPx), bottomPx];
      const br: [number, number] = [rightPx + dx(bottomPx), bottomPx];

      const v = quad * 4;
      positions.set(
        [tl[0], -tl[1], 0, tr[0], -tr[1], 0, bl[0], -bl[1], 0, br[0], -br[1], 0],
        v * 3
      );

      const uv = atlasUv(glyph.x, glyph.y, glyph.width, glyph.height);
      uvs.set([uv.u0, uv.vTop, uv.u1, uv.vTop, uv.u0, uv.vBottom, uv.u1, uv.vBottom], v * 2);

      indices.set([v + 2, v + 3, v, v + 3, v + 1, v], quad * 6);
      quad++;
    }
  });

  return { positions, uvs, indices };
}

let cachedAtlasTexture: THREE.Texture | null = null;

/**
 * The atlas PNG as a texture, created once and shared by identity across
 * every `<TextRun>` (textures/materials are identity-shared, not cloned per
 * consumer — only `Object3D` needs that). MSDF channels are distance-field
 * data, not colour, so `NoColorSpace` keeps them from being gamma-decoded.
 */
function getAtlasTexture(): THREE.Texture {
  if (!cachedAtlasTexture) {
    const texture = new THREE.TextureLoader().load(OPEN_SANS_ATLAS_PNG_DATA_URL);
    texture.colorSpace = THREE.NoColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    cachedAtlasTexture = texture;
  }
  return cachedAtlasTexture;
}

export interface TextRunProps {
  /** A `shapeText` result — uppercase and wrapping have already happened by the time it reaches here. */
  layout: TextLayoutResult;
  /** Must match the `fontSizePx` the layout was shaped at (atlas-bake-size geometry scales by `fontSizePx / 42`). */
  fontSizePx: number;
  /** Godot colour, sRGB; `.a` is opacity, `.r/.g/.b` are converted to linear for the shader. */
  tint: Color;
  /** Synthesized-italic shear. 0 (default) draws upright. */
  skew?: number;
  /** Synthesized-bold embolden, forwarded to the material. 0 (default) is the baked stroke weight. */
  distanceBias?: number;
  /**
   * Paint order for this run's mesh. A first-class prop rather than something a
   * caller arranges around it: consumers previously reached for either a
   * wrapping `<group renderOrder>` (relying on three's group-order cascade,
   * which an intermediate unset group silently resets) or an imperative
   * `traverse` — two different workarounds for one missing prop.
   */
  renderOrder?: number;
  /** Per-mesh clip planes (`controlClipping.tsx`'s hook) — forwarded to the material, per-material state. */
  clippingPlanes?: readonly THREE.Plane[];
  /** Forwarded to `createMsdfMaterial` — see its own doc. Omitted (2D-UI default) leaves the material's own `false`. */
  depthTest?: boolean;
  /** Forwarded to `createMsdfMaterial` — see its own doc. Omitted (2D-UI default) leaves `canvasItemFacing()`'s side; either way the run is drawn in one pass. */
  side?: THREE.Side;
  /**
   * Paints this run as a stroked glyph OUTLINE ring of this width (CSS px)
   * rather than a filled glyph — Godot's own separate outline surface
   * (`label_3d.cpp:610-615`), drawn from the same pen positions as the fill.
   * 0 (default) fills. Canvas-rasterised runs only; the MSDF atlas has no
   * contour to stroke.
   */
  strokeWidthPx?: number;
  /**
   * Magnification/minification of the rasterised glyph texture — Label3D's
   * `texture_filter` (`label_3d.h:140`). `'linear'` (default) is Godot's own
   * default's nearest/linear bit. Canvas-rasterised runs only; the MSDF atlas
   * decodes a distance field and is always sampled linearly.
   */
  textureFilter?: 'nearest' | 'linear';
  /**
   * Tags the mesh `tscnFrameExcluded`, which `frameSceneBounds.ts` skips —
   * for Label3D's own use ONLY (`LabelGlyphs.tsx`'s own doc has the
   * measurement): its real glyph geometry mounts asynchronously and, when it
   * happens to land inside `CameraFit`'s retry window, measurably grows the
   * auto-fit bounds past what Godot's own reference camera ever sees (it is
   * placed before ANY Label3D has shaped text, every time). Omitted
   * (default) for every 2D Control caller — their text is real, present
   * content with no such asynchronous-mount/framing quirk to route around.
   */
  frameExcluded?: boolean;
}

/** One built run — geometry + material, plus (canvas path only) the per-instance texture this component owns and must dispose (the MSDF atlas texture, by contrast, is cached/shared for the process's whole lifetime and must NEVER be disposed by a consumer — `getAtlasTexture`'s own doc). */
interface BuiltTextRun {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  ownedTexture?: THREE.Texture;
}

/**
 * The atlas branch is byte-for-byte what this component always did.
 * The canvas branch (`layout.fontMetrics.kind === 'canvas'`) is the ONLY
 * place this component's own doc's "internal dispatch" actually happens —
 * see that doc for why a per-slice `Component.tsx` never needs its own
 * branch. `strokeWidthPx` is canvas-only (there is no glyph contour in a
 * distance field to stroke) and synthesized-bold (`distanceBias`) is
 * atlas-only; each branch ignores the other's.
 */
function buildTextRun(
  layout: TextLayoutResult,
  fontSizePx: number,
  tint: Color,
  skew: number,
  distanceBias: number,
  clippingPlanes: readonly THREE.Plane[] | undefined,
  depthTest: boolean | undefined,
  side: THREE.Side | undefined,
  strokeWidthPx: number,
  textureFilter: 'nearest' | 'linear'
): BuiltTextRun {
  if (isCanvasFontMetrics(layout.fontMetrics)) {
    const canvasLayout = computeCanvasTextCanvasLayout(layout, skew, strokeWidthPx);
    const { positions, uvs, indices } = buildCanvasTextQuadArrays(canvasLayout);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    const canvas = paintSceneFontCanvas(layout, fontSizePx, tint, skew, canvasLayout, strokeWidthPx);
    const texture = new THREE.CanvasTexture(canvas);
    // DELIBERATELY `SRGBColorSpace`, not the `NoColorSpace` the general 2D-
    // canvas rule (`canvas2DTextureDecode.ts`'s own doc — `rendering/viewport/
    // hdr_2d` off, `rendering_server.cpp:3771`/`texture_storage.cpp:754`)
    // would suggest, and unlike every OTHER 2D-canvas-drawn texture (icons,
    // sprites, TextureRect images). Measured before deciding, not inferred:
    // magnifying this raster (`unit-control-scene-font-magnified.tscn`, whose
    // header has the full arbitration) showed `NoColorSpace` producing a
    // 5/255 dip BELOW the backdrop at the glyph edge that Godot's OWN render
    // of the SAME scene never shows (a perfectly monotonic ramp) — the tag
    // this replaces was already the correct one.
    //
    // The general rule holds for a texture with two GENUINELY DIFFERING
    // opaque RGB values (an icon's ink vs. its rect, `72ab8896`'s own
    // measurement) or a real colour-to-transparent(RGB=0) edge. Godot's own
    // GLYPH texture is neither: for a plain (non-MSDF, non-colour-emoji) font,
    // `modules/text_server_adv/text_server_adv.cpp` (`rasterize_bitmap`,
    // `FT_PIXEL_MODE_GRAY` branch, ~:1170-1174) allocates an `Image::
    // FORMAT_LA8` glyph texture and writes `wr[ofs+0] = 255` (the "colour"
    // channel, CONSTANT wherever FreeType wrote any coverage at all) and
    // `wr[ofs+1] = <coverage byte>` (the only channel that varies). Godot's
    // canvas then modulates this constant-255 channel by `font_color` and
    // blends by the ALPHA channel alone — which is never sRGB-encoded on
    // either side of any GPU pipeline, by definition (only RGB carries a
    // gamma curve) — so the byte-vs-decoded-first BLEND ORDER this whole
    // file's sibling fix (`f2024064`) exists to correct is, for Godot's own
    // text rendering, not merely closed but never open: there is no non-
    // degenerate RGB pair for a filter to blend in the wrong order.
    //
    // THIS engine's canvas-2D `fillText` raster (`canvasTextPainter.ts`) is
    // architecturally different — it bakes the actual ink colour into RGB
    // (Canvas 2D's non-premultiplied-pixel guarantee) rather than carrying a
    // separate coverage-only channel, and `CANVAS_TEXT_SUPERSAMPLE`'s 3x
    // raster resolution puts a genuinely near-degenerate `(R=0,A=0)` texel
    // immediately beside a near-fully-covered `(R=ink,A=255)` one at a
    // glyph's outer edge (`canvasTextPainter.ts`'s own doc: the canvas starts
    // at the browser's cleared `(0,0,0,0)` state and only `fillText` ever
    // paints into it) — which is exactly the two-genuinely-different-values
    // shape the general rule is FOR. Retagging this texture therefore
    // reproduces a fringe Godot's reference never has, rather than removing
    // one: `SRGBColorSpace`'s hardware pre-filter decode happens, empirically,
    // to suppress it for this specific "0 beside a near-constant colour"
    // shape (it does NOT for two genuinely different opaque colours — that is
    // exactly the bug the sibling fixes close). A future change to THIS
    // architecture (splitting the raster into a coverage-only channel plus a
    // separately-modulated colour, matching Godot's own model exactly) would
    // reopen this question; a plain retag today would not.
    texture.colorSpace = THREE.SRGBColorSpace;
    // `generateMipmaps` stays off for every filter: Godot's own default asks
    // for mipmaps, but a per-label raster rebuilt on every text/size change
    // is the wrong thing to build a chain for, so the minified case samples
    // the base level. Only the nearest/linear bit is honoured.
    texture.generateMipmaps = false;
    const filter = textureFilter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter;
    texture.minFilter = filter;
    texture.magFilter = filter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const material = createCanvasTextMaterial({ map: texture, opacity: tint.a, clippingPlanes, depthTest, side });
    return { geometry: geo, material, ownedTexture: texture };
  }

  const { positions, uvs, indices } = buildGlyphQuadArrays(layout, fontSizePx, skew);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
  const material = createMsdfMaterial({
    map: getAtlasTexture(),
    color: { r, g, b },
    opacity: tint.a,
    pxRange: OPEN_SANS_ATLAS_INFO.distanceRange,
    distanceBias,
    clippingPlanes,
    depthTest,
    side,
  });
  return { geometry: geo, material };
}

export function TextRun({
  layout,
  fontSizePx,
  tint,
  skew = 0,
  distanceBias = 0,
  clippingPlanes,
  renderOrder = 0,
  depthTest,
  side,
  strokeWidthPx = 0,
  textureFilter = 'linear',
  frameExcluded,
}: TextRunProps) {
  const { geometry, material, ownedTexture } = useMemo(
    () => buildTextRun(layout, fontSizePx, tint, skew, distanceBias, clippingPlanes, depthTest, side, strokeWidthPx, textureFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tint` is compared by its own r/g/b/a fields, not object identity (a caller re-creating an equal-valued tint object every render, as several already do, must not rebuild the mesh) -- the SAME per-field contract the pre-dispatch code already had for the material-only memo, now covering geometry/texture too since the canvas branch rasterises `tint` into the texture itself.
    [layout, fontSizePx, tint.r, tint.g, tint.b, tint.a, skew, distanceBias, clippingPlanes, depthTest, side, strokeWidthPx, textureFilter]
  );

  // R3F does not dispose a geometry/material passed as a PROP (only ones it
  // created from JSX args), so both leak on every rebuild without this. Cheap
  // before anything rendered through TextRun; now one Label mounts a run per
  // line and re-shapes on every rect or font change.
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  // The canvas path's per-instance raster texture (`ownedTexture`) is NOT
  // the shared, cached MSDF atlas texture `getAtlasTexture()` returns (which
  // must never be disposed by a consumer) — it is fresh on every rebuild of
  // THIS run and must be disposed the same way geometry/material are.
  useEffect(() => () => ownedTexture?.dispose(), [ownedTexture]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      renderOrder={renderOrder}
      userData={frameExcluded ? { tscnFrameExcluded: true } : undefined}
    />
  );
}
