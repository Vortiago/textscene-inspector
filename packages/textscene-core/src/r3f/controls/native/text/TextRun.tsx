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
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import { getAtlasTexture, useIsAtlasDecoded } from './atlasTexture';
import { createMsdfMaterial } from './msdfMaterial';
import {
  computeCanvasTextCanvasLayout,
  buildCanvasTextQuadArrays,
  paintSceneFontCanvas,
  createCanvasTextMaterial,
  type CanvasTextBlend,
} from './canvasTextPainter';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import type { TextLayoutResult } from './textLayout';
import { hexCodeBoxRects } from './hexCodeBox';
import { CanvasItemGroup } from '../../../components/CanvasItemGroup';
import { ControlQuad } from '../controlQuad';
import type { Color } from '../../../../nodes/base/node2d/types';
import { sRGBToLinearRGB } from '../../../../utils/colorSpace';
import type { FadeVariants } from '../../../materials/fadeVariants';
import { useSwappedMaterials } from '../../../materials/swappedMaterials';
import { usePendingWhile } from '../../../../resources/usePendingWhile';
import type { ShadowCastingEffects } from '../../../shadowCasting';

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
      positions.set([tl[0], -tl[1], 0, tr[0], -tr[1], 0, bl[0], -bl[1], 0, br[0], -br[1], 0], v * 3);

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
   * `alpha_cut` (`label_3d.cpp:386-393`), in each pass its GeometryInstance3D's fade can draw it
   * in. Canvas runs inside a GeometryInstance3D drawer only. Omitted, it paints
   * `TRANSPARENCY_ALPHA`, a Control's only mode.
   */
  blends?: FadeVariants<CanvasTextBlend>;
  /**
   * The draw hooks of the GeometryInstance3D the run draws for, with `castShadow` for this
   * surface (Label3D only). Omitted, the run casts nothing and draws in every pass.
   */
  shadow?: ShadowCastingEffects;
  /**
   * Tags the mesh `tscnFrameExcluded`, which `frameSceneBounds.ts` skips. Label3D
   * only (`LabelGlyphs.tsx`): its glyphs mount asynchronously and could grow the
   * auto-fit bounds past Godot's camera, which is placed before any text shapes.
   */
  frameExcluded?: boolean;
}

/**
 * One built run: its geometry, and on the canvas path the per-instance texture this component
 * disposes. The shared atlas texture is never disposed. `paint` builds a material for the run,
 * one for each pass a GeometryInstance3D's fade can draw it in.
 */
interface BuiltTextRun {
  geometry: THREE.BufferGeometry;
  paint: (blend: CanvasTextBlend | undefined) => THREE.Material;
  ownedTexture?: THREE.Texture;
}

/** What both painters' materials read, apart from the blend. */
interface TextRunLook {
  tint: Color;
  clippingPlanes: readonly THREE.Plane[] | undefined;
  depthTest: boolean | undefined;
  side: THREE.Side | undefined;
}

/**
 * Dispatches on `layout.fontMetrics.kind`, so no slice's `Component.tsx` branches.
 * `strokeWidthPx` is canvas-only and `distanceBias` atlas-only. Each branch
 * ignores the other's.
 */
function buildTextRun(
  layout: TextLayoutResult,
  fontSizePx: number,
  look: TextRunLook,
  skew: number,
  distanceBias: number,
  strokeWidthPx: number,
  textureFilter: 'nearest' | 'linear',
  outlineColor: Color | undefined,
  outlineWidthPx: number
): BuiltTextRun {
  const { tint, clippingPlanes, depthTest, side } = look;
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

    const opacity = tint.a;
    const paint = (blend: CanvasTextBlend | undefined) =>
      createCanvasTextMaterial({ map: texture, opacity, clippingPlanes, depthTest, side, ...blend });
    return { geometry: geo, paint, ownedTexture: texture };
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
  const options = {
    map: getAtlasTexture(),
    color: { r, g, b },
    opacity: tint.a,
    pxRange: OPEN_SANS_ATLAS_INFO.distanceRange,
    distanceBias,
    clippingPlanes,
    depthTest,
    side,
    outline,
  };
  // The atlas painter has no blend modes: only a canvas run takes `blends`.
  return { geometry: geo, paint: () => createMsdfMaterial(options) };
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
  blends,
  shadow,
  frameExcluded,
  outlineColor,
  outlineWidthPx = 0,
}: TextRunProps) {
  const swapped = useSwappedMaterials(undefined);
  if (blends && !swapped)
    throw new Error('expected blends only inside a GeometryInstance3D drawer, got none');

  const run = useMemo(
    () =>
      buildTextRun(
        layout,
        fontSizePx,
        { tint, clippingPlanes, depthTest, side },
        skew,
        distanceBias,
        strokeWidthPx,
        textureFilter,
        outlineColor,
        outlineWidthPx
      ),
    // `tint` and `outlineColor` are compared by their fields, not by identity: a caller
    // that re-creates an equal object every render must not rebuild the mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per-field comparison, as above.
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
      outlineColor?.r,
      outlineColor?.g,
      outlineColor?.b,
      outlineColor?.a,
      outlineWidthPx,
    ]
  );
  const material = usePaintedMaterial(run, blends?.unfaded);
  const alphaPassMaterial = useAlphaPassMaterial(run, blends?.alphaPass);
  const meshRef = useRef<THREE.Mesh | null>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!swapped || !alphaPassMaterial || !mesh) return;
    const detachUnfaded = swapped.unfaded(mesh, material);
    const detachAlphaPass = swapped.alphaPass(mesh, alphaPassMaterial);
    return () => {
      detachAlphaPass();
      detachUnfaded();
    };
  }, [swapped, material, alphaPassMaterial]);

  // R3F does not dispose a geometry or material passed as a prop, so both leak
  // on every rebuild without this, and a Label re-shapes on every rect or font change.
  useEffect(() => () => run.geometry.dispose(), [run]);
  // The canvas path's raster texture is fresh per rebuild, unlike the shared atlas.
  useEffect(() => () => run.ownedTexture?.dispose(), [run]);

  // `draw_hex_code_box` (`text_server.cpp:771-812`) draws in its caller's colour:
  // this run's `tint`, converted to linear once as for every `ControlQuad`.
  const hexBoxRects = useMemo(() => collectHexCodeBoxRects(layout, fontSizePx), [layout, fontSizePx]);
  const hexBoxColor = useMemo(() => {
    const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
    return new THREE.Color(r, g, b);
  }, [tint.r, tint.g, tint.b]);

  return (
    <>
      {/* A canvas run owns its texture. Only an atlas run waits for the atlas. */}
      {!run.ownedTexture && <AtlasPending />}
      <mesh
        ref={meshRef}
        geometry={run.geometry}
        // A faded run's materials go on through the swap alone, which the fade owns.
        material={alphaPassMaterial ? undefined : material}
        renderOrder={renderOrder}
        userData={frameExcluded ? { tscnFrameExcluded: true } : undefined}
        castShadow={shadow?.castShadow}
        onBeforeRender={shadow?.onBeforeRender}
        onAfterRender={shadow?.onAfterRender}
        onBeforeShadow={shadow?.onBeforeShadow}
        onAfterShadow={shadow?.onAfterShadow}
      />
      {hexBoxRects.map((r, i) => (
        <CanvasItemGroup key={i} position={[r.x, -r.y, 0]}>
          <ControlQuad
            width={r.w}
            height={r.h}
            color={hexBoxColor}
            opacity={tint.a}
            renderOrder={renderOrder}
            drawHooks={shadow}
          />
        </CanvasItemGroup>
      ))}
    </>
  );
}

/**
 * A pending load while the atlas has not decoded, as an atlas run draws nothing until then. A child,
 * so the decode re-renders it and not the run.
 */
function AtlasPending(): null {
  usePendingWhile(!useIsAtlasDecoded());
  return null;
}

/** The run's material for `blend`. */
function usePaintedMaterial(run: BuiltTextRun, blend: CanvasTextBlend | undefined): THREE.Material {
  return useOwnedMaterial(run, blend, () => run.paint(blend));
}

/** The run's alpha-pass material, or null for a run that never fades. */
function useAlphaPassMaterial(run: BuiltTextRun, blend: CanvasTextBlend | undefined): THREE.Material | null {
  return useOwnedMaterial(run, blend, () => (blend ? run.paint(blend) : null));
}

/**
 * The material `paint` builds, rebuilt only when `run` or a field of `blend` changes, and disposed
 * on replacement: R3F does not dispose a material passed as a prop.
 */
function useOwnedMaterial<M extends THREE.Material | null>(
  run: BuiltTextRun,
  blend: CanvasTextBlend | undefined,
  paint: () => M
): M {
  const material = useMemo(
    () => paint(),
    // `blend` is compared by its fields, as `run` is above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per-field comparison.
    [
      run,
      blend?.transparent,
      blend?.depthWrite,
      blend?.alphaTest,
      blend?.alphaHash,
      blend?.alphaHashScale,
      blend?.opaquePrepass,
      blend?.blending,
      blend?.injection,
    ]
  );
  useEffect(() => () => material?.dispose(), [material]);
  return material;
}
