/**
 * Merged glyph quads for one `shapeText` layout: every visible glyph on every line
 * as one `THREE.BufferGeometry` and material. Every text-painting Control uses it,
 * and `layout.fontMetrics.kind` picks the painter: the MSDF atlas for `'atlas'`,
 * `canvasTextPainter.ts`'s single raster quad for `'canvas'`, and `bitmapTextPainter.ts`'s quad for
 * each glyph of a BMFont for `'bitmap'`. All three place a line by its box-top Y alone.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { visualLayersUserData } from '../../../visualLayers';
import * as THREE from 'three';
import { getAtlasTexture, useIsAtlasDecoded } from './atlasTexture';
import { createMsdfMaterial } from './msdfMaterial';
import {
  useCanvasItemPixelMaterial,
  type CanvasItemPixelMaterial,
} from '../../../components/LitCanvasItemPixels';
import { msdfDistanceBias } from './msdfEmbolden';
import {
  computeCanvasTextCanvasLayout,
  buildCanvasTextQuadArrays,
  paintSceneFontCanvas,
  createCanvasTextMaterial,
  type CanvasTextPaintOptions,
} from './canvasTextPainter';
import type { SurfaceShading } from '../../../materialFor2d';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import { isBitmapFontMetrics, type BitmapFontMetrics } from './bitmapFontMetrics';
import { buildBitmapQuads, createSheetTexture } from './bitmapTextPainter';
import type { TextLayoutResult } from './textLayout';
import { hexCodeBoxRects } from './hexCodeBox';
import { buildGlyphQuadArrays, type GlyphQuadArrays } from './glyphQuads';
import { OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import { CanvasItemGroup } from '../../../components/CanvasItemGroup';
import { ControlQuad } from '../controlQuad';
import {
  applyTextureFilterState,
  godotTextureFilterState,
  type TextureFilterState,
} from '../../../../resources/textures/godotTextureFilter';
import { sRGBToLinearRGB } from '../../../../utils/colorSpace';
import type { SurfaceBlend } from '../../../materials/surfaceBlend';
import type { FadeVariants } from '../../../materials/fadeVariants';
import { useSwappedMaterials } from '../../../materials/swappedMaterials';
import { usePendingWhile } from '../../../../resources/usePendingWhile';
import type { ShadowCastingEffects } from '../../../shadowCasting';
import type { Rgba } from '../../../../godot/math/math';
import { useDisposeOnRelease } from '../../../useDisposeOnRelease';
import { useNearestAnisotropy } from '../../../nearestAnisotropy';

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
  tint: Rgba;
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
   * Rounds each glyph pen as a canvas item draws it (`canvasGlyphPenXPx`). Label3D passes false, as
   * its mesh keeps the pen (`label_3d.cpp:347`). Canvas runs only: the MSDF atlas keeps the pen too.
   */
  quantisesPen?: boolean;
  /** Where the run's x 0 sits in its canvas item, which a rounded pen includes (`text_server_adv.cpp:4074-4084`). Canvas runs only. */
  penOriginXPx?: number;
  /**
   * The raster texture's sampler: Label3D's `texture_filter` (`label_3d.h:140`). The default is
   * Godot's default filter. A mipmapped row samples a mip chain only where `mipmapped` built one.
   * Canvas runs only: the MSDF atlas is always sampled linearly.
   */
  textureFilter?: TextureFilterState;
  /**
   * Builds a mip chain for the raster, as Godot does for a font with `generate_mipmaps`
   * (`text_server_adv.cpp:3121`), and samples it at the viewport's mipmap bias. Canvas runs
   * drawn in 3D only. Omitted, the raster has no chain, as a font without that flag has none.
   */
  mipmapped?: boolean;
  /**
   * The PBR uniforms that light the run with the scene's 3D lights and let it receive their shadows,
   * as a shaded Label3D (`material.cpp:3045`). The quad faces +Z (`label_3d.cpp:422-423`). Canvas
   * runs only: the MSDF atlas serves Controls, which draw unlit. Omitted, unlit.
   */
  shading?: SurfaceShading;
  /**
   * The `BaseMaterial3D::Transparency` this surface paints in, from a 3D caller's
   * `alpha_cut` (`label_3d.cpp:386-393`), in each pass its GeometryInstance3D's fade can draw it
   * in. Canvas runs inside a GeometryInstance3D drawer only. Omitted, it paints
   * `TRANSPARENCY_ALPHA`, a Control's only mode.
   */
  blends?: FadeVariants<SurfaceBlend>;
  /**
   * The draw hooks of the GeometryInstance3D the run draws for, with `castShadow` for this
   * surface (Label3D only). Omitted, the run casts nothing and draws in every pass.
   */
  shadow?: ShadowCastingEffects;
  /** The `layers` of the Label3D the run draws for, which a ReflectionProbe's `cull_mask` tests. */
  layers?: number;
  /**
   * Tags the mesh `tscnFrameExcluded`, which `frameSceneBounds.ts` skips. Label3D
   * only (`LabelGlyphs.tsx`): its glyphs mount asynchronously and could grow the
   * auto-fit bounds past Godot's camera, which is placed before any text shapes.
   */
  frameExcluded?: boolean;
}

/** The normal +Z on each of `vertexCount` vertices, which only a lit material reads. */
function quadFacingPlusZ(vertexCount: number): THREE.BufferAttribute {
  const normals = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) normals[i * 3 + 2] = 1;
  return new THREE.BufferAttribute(normals, 3);
}

/**
 * One built run: its geometry, and on the canvas path the per-instance texture this component
 * disposes. Each canvas that unmounts releases the shared atlas. `paint` builds a material for the run,
 * one for each pass a GeometryInstance3D's fade can draw it in.
 */
interface BuiltTextRun {
  geometry: THREE.BufferGeometry;
  paint: (blend: SurfaceBlend | undefined, shading: SurfaceShading | undefined) => THREE.Material;
  ownedTexture?: THREE.Texture;
}

/** What both painters' materials read, apart from the blend. */
interface TextRunLook {
  tint: Rgba;
  clippingPlanes: readonly THREE.Plane[] | undefined;
  depthTest: boolean | undefined;
  side: THREE.Side | undefined;
  /** The lit Control around the run, or undefined for a run no 2D light reaches, such as Label3D's. */
  pixelMaterial: CanvasItemPixelMaterial | undefined;
}

/** The geometry of merged glyph quads. A lit run reads the normal, so a caller adds it. */
function quadGeometry({ positions, uvs, indices }: GlyphQuadArrays): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

/**
 * A BMFont run: one quad for each glyph over a texture of the font's page fills, drawn as a Control
 * draws any texture. The tint multiplies the page colour, as Godot's modulate does for a font with
 * no FreeType face (`text_server_adv.cpp:4045`). An outline pass draws the font's outline set, at
 * the glyph's own rectangle, for every outline size (`text_server_adv.h:406-414`, `font.cpp:1712-1717`).
 * A positive `strokeWidthPx` is that outline pass.
 */
function buildBitmapRun(
  layout: TextLayoutResult,
  metrics: BitmapFontMetrics,
  fontSizePx: number,
  look: TextRunLook,
  textureFilter: TextureFilterState,
  { strokeWidthPx = 0, penOriginXPx = 0 }: CanvasTextPaintOptions
): BuiltTextRun {
  const { tint, clippingPlanes, depthTest, side, pixelMaterial } = look;
  const isOutlinePass = strokeWidthPx > 0;
  const sheet = isOutlinePass ? metrics.bitmap.outlineSheet : metrics.bitmap.sheet;
  const quads = buildBitmapQuads(layout, metrics, fontSizePx, sheet, penOriginXPx);
  const geometry = quadGeometry(quads);
  geometry.setAttribute('normal', quadFacingPlusZ(quads.positions.length / 3));
  const texture = createSheetTexture(sheet);
  applyTextureFilterState(texture, textureFilter);
  const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
  const paint = (blend: SurfaceBlend | undefined, shading: SurfaceShading | undefined) =>
    createCanvasTextMaterial({
      map: texture,
      color: new THREE.Color(r, g, b),
      opacity: tint.a,
      clippingPlanes,
      depthTest,
      side,
      pixelMaterial,
      shading,
      ...blend,
    });
  return { geometry, paint, ownedTexture: texture };
}

/**
 * Dispatches on `layout.fontMetrics.kind`, so no slice's `Component.tsx` branches. The face sets the
 * shear (`FontMetrics.skew`). `canvasPaint` is canvas-only, and the embolden's distance bias
 * (`msdfDistanceBias`) atlas-only. Each branch ignores the other's, except that a BMFont run reads
 * a positive stroke width as its outline pass.
 */
function buildTextRun(
  layout: TextLayoutResult,
  fontSizePx: number,
  look: TextRunLook,
  canvasPaint: CanvasTextPaintOptions,
  textureFilter: TextureFilterState,
  mipmapped: boolean
): BuiltTextRun {
  const { tint, clippingPlanes, depthTest, side, pixelMaterial } = look;
  const skew = layout.fontMetrics.skew ?? 0;
  if (isBitmapFontMetrics(layout.fontMetrics)) {
    return buildBitmapRun(layout, layout.fontMetrics, fontSizePx, look, textureFilter, canvasPaint);
  }
  if (isCanvasFontMetrics(layout.fontMetrics)) {
    const canvasLayout = computeCanvasTextCanvasLayout(layout, skew, canvasPaint.strokeWidthPx);
    const quads = buildCanvasTextQuadArrays(canvasLayout);
    const geo = quadGeometry(quads);
    const { positions } = quads;
    // On every run, so toggling the shading rebuilds the material alone, not the raster.
    geo.setAttribute('normal', quadFacingPlusZ(positions.length / 3));

    const canvas = paintSceneFontCanvas(layout, fontSizePx, tint, skew, canvasLayout, canvasPaint);
    const texture = new THREE.CanvasTexture(canvas);
    // `SRGBColorSpace`, not the 2D-canvas rule's `NoColorSpace`: measured, `NoColorSpace` dips
    // 5/255 below the backdrop at a glyph edge, where Godot draws a monotonic ramp. `textRun.md`
    // gives the engine lines, and why a raster split into coverage plus colour would reopen this.
    texture.colorSpace = THREE.SRGBColorSpace;
    // No chain unless the caller asks: Godot's default font generates none
    // (`text_server.cpp:2387`), and a raster rebuilt on every text or size change is costly to mipmap.
    texture.generateMipmaps = mipmapped;
    applyTextureFilterState(texture, textureFilter);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const opacity = tint.a;
    const paint = (blend: SurfaceBlend | undefined, shading: SurfaceShading | undefined) =>
      createCanvasTextMaterial({
        map: texture,
        opacity,
        clippingPlanes,
        depthTest,
        side,
        pixelMaterial,
        mipmapped,
        shading,
        ...blend,
      });
    return { geometry: geo, paint, ownedTexture: texture };
  }

  const geo = quadGeometry(buildGlyphQuadArrays(layout, fontSizePx, skew));

  const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
  const options = {
    map: getAtlasTexture(),
    color: { r, g, b },
    opacity: tint.a,
    pxRange: OPEN_SANS_ATLAS_INFO.distanceRange,
    distanceBias: msdfDistanceBias(layout),
    clippingPlanes,
    depthTest,
    side,
    pixelMaterial,
  };
  // The atlas painter has no blend modes: only a canvas run takes `blends`.
  return { geometry: geo, paint: () => createMsdfMaterial(options) };
}

export function TextRun({
  layout,
  fontSizePx,
  tint,
  clippingPlanes,
  renderOrder = 0,
  depthTest,
  side,
  strokeWidthPx = 0,
  quantisesPen = true,
  penOriginXPx = 0,
  textureFilter = godotTextureFilterState(undefined),
  mipmapped = false,
  blends,
  shadow,
  layers,
  frameExcluded,
  shading,
}: TextRunProps) {
  const swapped = useSwappedMaterials(undefined);
  const pixelMaterial = useCanvasItemPixelMaterial();
  if (blends && !swapped)
    throw new Error('expected blends only inside a GeometryInstance3D drawer, got none');

  const run = useMemo(
    () =>
      buildTextRun(
        layout,
        fontSizePx,
        { tint, clippingPlanes, depthTest, side, pixelMaterial },
        { strokeWidthPx, quantisesPen, penOriginXPx },
        textureFilter,
        mipmapped
      ),
    // `tint` is compared by its fields, not by identity: a caller that re-creates an equal
    // object every render must not rebuild the mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per-field comparison, as above.
    [
      layout,
      fontSizePx,
      tint.r,
      tint.g,
      tint.b,
      tint.a,
      clippingPlanes,
      depthTest,
      side,
      pixelMaterial,
      strokeWidthPx,
      quantisesPen,
      penOriginXPx,
      textureFilter,
      mipmapped,
    ]
  );
  const material = usePaintedMaterial(run, blends?.unfaded, shading);
  const alphaPassMaterial = useAlphaPassMaterial(run, blends?.alphaPass, shading);
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
  useDisposeOnRelease(run.geometry);
  // The canvas path's raster texture is fresh per rebuild, unlike the shared atlas.
  useDisposeOnRelease(run.ownedTexture);
  useNearestAnisotropy(run.ownedTexture ?? null);

  // `draw_hex_code_box` (`text_server.cpp:771-812`) draws in its caller's colour:
  // this run's `tint`, converted to linear once as for every `ControlQuad`.
  const hexBoxRects = useMemo(() => collectHexCodeBoxRects(layout, fontSizePx), [layout, fontSizePx]);
  const hexBoxColor = useMemo(() => {
    const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
    return new THREE.Color(r, g, b);
  }, [tint.r, tint.g, tint.b]);
  // Memoised, as R3F assigns a new `userData` object on each render and drops what it held.
  const userData = useMemo(
    () => ({
      ...(frameExcluded && { tscnFrameExcluded: true }),
      ...(layers !== undefined && visualLayersUserData(layers)),
    }),
    [frameExcluded, layers]
  );

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
        userData={userData}
        castShadow={shadow?.castShadow}
        receiveShadow={shading !== undefined}
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
function usePaintedMaterial(
  run: BuiltTextRun,
  blend: SurfaceBlend | undefined,
  shading: SurfaceShading | undefined
): THREE.Material {
  return useOwnedMaterial(run, blend, shading, () => run.paint(blend, shading));
}

/** The run's alpha-pass material, or null for a run that never fades. */
function useAlphaPassMaterial(
  run: BuiltTextRun,
  blend: SurfaceBlend | undefined,
  shading: SurfaceShading | undefined
): THREE.Material | null {
  return useOwnedMaterial(run, blend, shading, () => (blend ? run.paint(blend, shading) : null));
}

/**
 * The material `paint` builds, rebuilt only when `run`, `shading` or a field of `blend` changes, and
 * disposed on replacement: R3F does not dispose a material passed as a prop.
 */
function useOwnedMaterial<M extends THREE.Material | null>(
  run: BuiltTextRun,
  blend: SurfaceBlend | undefined,
  shading: SurfaceShading | undefined,
  paint: () => M
): M {
  const material = useMemo(
    () => paint(),
    // `blend` and `shading` are compared by their fields, as `run` is above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per-field comparison.
    [
      run,
      shading?.metalness,
      shading?.roughness,
      blend?.transparent,
      blend?.depthWrite,
      blend?.alphaTest,
      blend?.alphaHash,
      blend?.alphaHashScale,
      blend?.opaquePrepass,
      blend?.blending,
      blend?.antialiasing?.mode,
      blend?.antialiasing?.scissorThreshold,
      blend?.antialiasing?.edge,
      blend?.injection,
    ]
  );
  useDisposeOnRelease(material);
  return material;
}
