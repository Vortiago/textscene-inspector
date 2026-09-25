/**
 * Merged glyph quads for one `shapeText` layout: every visible glyph on every line
 * as one `THREE.BufferGeometry` and material. Every text-painting Control uses it,
 * and `layout.fontMetrics.kind` picks the painter: the MSDF atlas for `'atlas'`,
 * `canvasTextPainter.ts`'s single raster quad for `'canvas'`.
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
  type CanvasTextTransparency,
} from './canvasTextPainter';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import type { TextLayoutResult } from './textLayout';
import { hexCodeBoxRects } from './hexCodeBox';
import { CanvasItemGroup } from '../../../components/CanvasItemGroup';
import { ControlQuad } from '../controlQuad';
import type { Color } from '../../../../nodes/base/node2d/types';
import { sRGBToLinearRGB } from '../../../../utils/colorSpace';

// Geometry is in Godot pixels, +Y down, with Y negated once per vertex into three's
// Y-up space. Each line's top is a multiple of `layout.linePitchPx`, and its baseline
// sits `layout.baselineOffsetPx` below that, as Godot's `ofs.y += asc` does
// (`scene/gui/label.cpp:616,823`). Both painters take only a line's box-top Y.
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
 * Builds one merged quad set for `layout`, skipping a placement with no atlas
 * bitmap. It reconciles the atlas's bake anchor (`OPEN_SANS_ATLAS_INFO.base`, which
 * every `yoffset` is measured from) with the line's baseline, so a caller never adds it.
 */
// `skew` shears about the baseline: Godot's `FT_Outline_Transform` works on the
// loaded outline, whose origin is the baseline pen position
// (`modules/text_server_adv/text_server_adv.cpp:1318-1320`, `:3621-3623`). A top-edge
// pivot would shift a styled `[i]` run left, into the space before it.
export function buildGlyphQuadArrays(
  layout: TextLayoutResult,
  fontSizePx: number,
  skew = 0
): GlyphQuadArrays {
  const scale = fontSizePx / OPEN_SANS_ATLAS_INFO.fontSize;
  const baselineOffsetPx = layout.baselineOffsetPx;
  // How far the bake's line-top reference sits above the baseline, at the target size. A run
  // smaller than its line's size reads a few tenths of a pixel low, from Godot's per-size FreeType
  // hinting. `textRun.md` says why, and why no closed-form fix works without porting the hinter.
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

/** One rectangle of a hex-code box in local Godot px, +Y down, the space of `buildGlyphQuadArrays`' `topPx` before the Y negation. */
export interface HexCodeBoxAbsoluteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Every `hexCodeBoxRects` rectangle for every `controlCodepoint` placement, moved
 * from pen-relative space to the line's box-top space at the `baselinePx`
 * `buildGlyphQuadArrays` uses, since the box replaces that glyph's ink.
 */
function collectHexCodeBoxRects(layout: TextLayoutResult, fontSizePx: number): HexCodeBoxAbsoluteRect[] {
  const rects: HexCodeBoxAbsoluteRect[] = [];
  layout.lines.forEach((line, lineIndex) => {
    const lineTopPx = lineIndex * layout.linePitchPx;
    const baselinePx = lineTopPx + layout.baselineOffsetPx;
    for (const gp of line.glyphs) {
      if (gp.controlCodepoint === undefined) continue;
      for (const r of hexCodeBoxRects(fontSizePx, gp.controlCodepoint)) {
        rects.push({ x: gp.x + r.x, y: baselinePx + r.y, w: r.w, h: r.h });
      }
    }
  });
  return rects;
}

let cachedAtlasTexture: THREE.Texture | null = null;

/**
 * The atlas PNG as a texture, created once and shared by identity across every
 * `<TextRun>`, never disposed. MSDF channels are distance data, not colour, so
 * `NoColorSpace` keeps them from being gamma-decoded.
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
  /** A `shapeText` result, already uppercased and wrapped. */
  layout: TextLayoutResult;
  /** Must match the `fontSizePx` the layout was shaped at (atlas-bake-size geometry scales by `fontSizePx / 42`). */
  fontSizePx: number;
  /** Godot colour, sRGB. `.a` is opacity, and `.r/.g/.b` are converted to linear for the shader. */
  tint: Color;
  /** Synthesised-italic shear. The default 0 draws upright. */
  skew?: number;
  /** Synthesised-bold embolden, forwarded to the material. The default 0 is the baked weight. */
  distanceBias?: number;
  /**
   * Godot colour, sRGB, for `createMsdfMaterial`'s outline pass. `.a` is the
   * outline's opacity, apart from `tint.a`. Omitted, no outline. Atlas runs
   * only: a canvas raster has no distance field to threshold again.
   */
  outlineColor?: Color;
  /** Screen px the outline's threshold expands past the glyph edge. 0 or an absent `outlineColor` draws no outline. */
  outlineWidthPx?: number;
  /**
   * Paint order for this run's mesh. A prop, since a wrapping `<group renderOrder>`
   * cascade resets at any intermediate group without one.
   */
  renderOrder?: number;
  /** Per-mesh clip planes (`controlClipping.tsx`), forwarded to the material. */
  clippingPlanes?: readonly THREE.Plane[];
  /** Forwarded to `createMsdfMaterial`. Omitted, the material's `false` stays. */
  depthTest?: boolean;
  /** Forwarded to `createMsdfMaterial`. Omitted, `canvasItemFacing()`'s side stays. The run draws in one pass. */
  side?: THREE.Side;
  /**
   * Paints a stroked outline ring of this width (CSS px) instead of the fill, as
   * Godot's separate outline surface (`label_3d.cpp:610-615`) at the same pen
   * positions. The default 0 fills. Canvas runs only: MSDF has no contour.
   */
  strokeWidthPx?: number;
  /**
   * The raster texture's filter: Label3D's `texture_filter` (`label_3d.h:140`).
   * The default `'linear'` is the nearest/linear bit of Godot's default. Canvas
   * runs only: the MSDF atlas is always sampled linearly.
   */
  textureFilter?: 'nearest' | 'linear';
  /**
   * The `BaseMaterial3D::Transparency` this surface paints in, from a 3D caller's
   * `alpha_cut` (`label_3d.cpp:386-393`). Canvas runs only. Omitted, it paints
   * `TRANSPARENCY_ALPHA`, a Control's only mode.
   */
  transparency?: CanvasTextTransparency;
  /**
   * Tags the mesh `tscnFrameExcluded`, which `frameSceneBounds.ts` skips. Label3D
   * only (`LabelGlyphs.tsx`): its glyphs mount asynchronously and could grow the
   * auto-fit bounds past Godot's camera, which is placed before any text shapes.
   */
  frameExcluded?: boolean;
}

/** One built run: geometry and material, plus on the canvas path the per-instance texture this component disposes. The shared atlas texture is never disposed. */
interface BuiltTextRun {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  ownedTexture?: THREE.Texture;
}

/**
 * Dispatches on `layout.fontMetrics.kind`, so no slice's `Component.tsx` branches.
 * `strokeWidthPx` is canvas-only and `distanceBias` atlas-only. Each branch
 * ignores the other's.
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
  textureFilter: 'nearest' | 'linear',
  transparency: CanvasTextTransparency | undefined,
  outlineColor: Color | undefined,
  outlineWidthPx: number
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
    // `SRGBColorSpace`, not the 2D-canvas rule's `NoColorSpace`: measured, `NoColorSpace` dips
    // 5/255 below the backdrop at a glyph edge, where Godot draws a monotonic ramp. `textRun.md`
    // gives the engine lines, and why a raster split into coverage plus colour would reopen this.
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

    const material = createCanvasTextMaterial({
      map: texture,
      opacity: tint.a,
      clippingPlanes,
      depthTest,
      side,
      ...transparency,
    });
    return { geometry: geo, material, ownedTexture: texture };
  }

  const { positions, uvs, indices } = buildGlyphQuadArrays(layout, fontSizePx, skew);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
  let outline: { color: { r: number; g: number; b: number }; opacity: number; widthPx: number } | undefined;
  if (outlineColor && outlineWidthPx > 0) {
    const [or, og, ob] = sRGBToLinearRGB(outlineColor.r, outlineColor.g, outlineColor.b);
    outline = { color: { r: or, g: og, b: ob }, opacity: outlineColor.a, widthPx: outlineWidthPx };
  }
  const material = createMsdfMaterial({
    map: getAtlasTexture(),
    color: { r, g, b },
    opacity: tint.a,
    pxRange: OPEN_SANS_ATLAS_INFO.distanceRange,
    distanceBias,
    clippingPlanes,
    depthTest,
    side,
    outline,
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
  transparency,
  frameExcluded,
  outlineColor,
  outlineWidthPx = 0,
}: TextRunProps) {
  const { geometry, material, ownedTexture } = useMemo(
    () =>
      buildTextRun(
        layout,
        fontSizePx,
        tint,
        skew,
        distanceBias,
        clippingPlanes,
        depthTest,
        side,
        strokeWidthPx,
        textureFilter,
        transparency,
        outlineColor,
        outlineWidthPx
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tint`/`outlineColor` are compared by their own r/g/b/a fields, not object identity (a caller re-creating an equal-valued object every render, as several already do, must not rebuild the mesh) -- the SAME per-field contract the pre-dispatch code already had for the material-only memo, now covering geometry/texture too since the canvas branch rasterises `tint` into the texture itself, and `transparency` for the same reason.
    [
      layout,
      fontSizePx,
      tint.r,
      tint.g,
      tint.b,
      tint.a,
      skew,
      distanceBias,
      clippingPlanes,
      depthTest,
      side,
      strokeWidthPx,
      textureFilter,
      transparency?.transparent,
      transparency?.depthWrite,
      transparency?.alphaTest,
      transparency?.alphaHash,
      outlineColor?.r,
      outlineColor?.g,
      outlineColor?.b,
      outlineColor?.a,
      outlineWidthPx,
    ]
  );

  // R3F does not dispose a geometry or material passed as a prop, so both leak
  // on every rebuild without this, and a Label re-shapes on every rect or font change.
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  // The canvas path's raster texture is fresh per rebuild, unlike the shared atlas.
  useEffect(() => () => ownedTexture?.dispose(), [ownedTexture]);

  // `draw_hex_code_box` (`text_server.cpp:771-812`) draws in its caller's colour:
  // this run's `tint`, converted to linear once as for every `ControlQuad`.
  const hexBoxRects = useMemo(() => collectHexCodeBoxRects(layout, fontSizePx), [layout, fontSizePx]);
  const hexBoxColor = useMemo(() => {
    const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
    return new THREE.Color(r, g, b);
  }, [tint.r, tint.g, tint.b]);

  return (
    <>
      <mesh
        geometry={geometry}
        material={material}
        renderOrder={renderOrder}
        userData={frameExcluded ? { tscnFrameExcluded: true } : undefined}
      />
      {hexBoxRects.map((r, i) => (
        <CanvasItemGroup key={i} position={[r.x, -r.y, 0]}>
          <ControlQuad width={r.w} height={r.h} color={hexBoxColor} opacity={tint.a} renderOrder={renderOrder} />
        </CanvasItemGroup>
      ))}
    </>
  );
}
