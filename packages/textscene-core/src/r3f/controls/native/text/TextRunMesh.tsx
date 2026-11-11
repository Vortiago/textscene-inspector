/**
 * Merged glyph quads for one `shapeText` layout: every visible glyph on every line
 * as one `THREE.BufferGeometry` and material. `TextRun.tsx` routes each run here, and
 * `layout.fontMetrics.kind` picks the painter: the MSDF atlas for `'atlas'`,
 * `canvasTextPainter.ts`'s single raster quad for `'canvas'`, and `bitmapTextPainter.ts`'s quad for
 * each glyph of a BMFont for `'bitmap'`. All three place a line by its box-top Y alone.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { visualLayersUserData } from '../../../visualLayers';
import * as THREE from 'three';
import { getAtlasTexture, useIsAtlasDecoded } from './atlasTexture';
import { createMsdfMaterial } from './msdfMaterial';
import {
  useCanvasItemPixelMaterial,
  type CanvasItemPixelMaterial,
} from '../../../components/LitCanvasItemPixels';
import {
  computeCanvasTextCanvasLayout,
  buildCanvasTextQuadArrays,
  paintSceneFontCanvas,
  createCanvasTextMaterial,
  originPhase,
  snapsGlyphsToItemPixels,
  type CanvasTextCanvasLayout,
  type CanvasTextPaintOptions,
} from './canvasTextPainter';
import type { SurfaceShading } from '../../../materialFor2d';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import { isBitmapFontMetrics, type BitmapFontMetrics } from './bitmapFontMetrics';
import { bitmapFloorsPen, buildBitmapQuads, createSheetTexture } from './bitmapTextPainter';
import type { FillSheet } from '../../../../resources/fonts/font/types';
import { perObject } from '../../../../utils/perObject';
import { GLYPH_DRAWER_RULES, type GlyphDrawer } from './glyphDrawer';
import type { TextLayoutResult } from './textLayout';
import { hexCodeBoxRects } from './hexCodeBox';
import { buildGlyphQuadArrays, type GlyphQuadArrays } from './glyphQuads';
import { OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import { CanvasItemGroup, useCanvasItemOrigin } from '../../../components/CanvasItemGroup';
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
import { VECTOR2_ZERO } from '../../../../godot/math/vector';
import { useDisposeOnRelease } from '../../../useDisposeOnRelease';
import { useNearestAnisotropy } from '../../../nearestAnisotropy';

/** One rectangle of a hex-code box in local Godot px, +Y down, the space of `buildGlyphQuadArrays`' `topPx` before the Y negation. */
interface HexCodeBoxAbsoluteRect {
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
   * positions. The default 0 fills. `TextRun` strokes an atlas face on the bundled canvas face.
   */
  strokeWidthPx?: number;
  /**
   * The Godot code that draws the glyphs, `'canvasItem'` by default (`glyphDrawer.ts`). A canvas item
   * places each glyph at the run's place in the item (`useCanvasItemOrigin`): the pen on its subpixel
   * step and the baseline on a whole pixel (`text_server_adv.cpp:4074-4084`). Label3D passes `'label3D'`,
   * whose mesh keeps both, skips small glyphs and draws no hex-code box. The MSDF atlas keeps the pen too.
   */
  glyphDrawer?: GlyphDrawer;
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
  /**
   * What the GeometryInstance3D the run draws for adds to the run's mesh (Label3D only). Omitted,
   * the run draws its own material and nothing more.
   */
  instance?: RunInstance;
}

/** The passes a geometry instance adds to a run's mesh. */
export interface RunInstance {
  /** `material_override` stands, so the passes mount the surface's material and the run mounts none. */
  isOverridden: boolean;
  /** The instance's passes for the run's mesh, mounted inside it. */
  passes: (meshRef: RefObject<THREE.Mesh | null>) => ReactNode;
}

/** The normal +Z on each of `vertexCount` vertices, which only a lit material reads. */
function quadFacingPlusZ(vertexCount: number): THREE.BufferAttribute {
  const normals = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) normals[i * 3 + 2] = 1;
  return new THREE.BufferAttribute(normals, 3);
}

/**
 * One built run: its geometry, and on the canvas and BMFont paths the texture this component holds
 * and the last holder disposes. The atlas is shared and never disposed. `paint` builds a material
 * for the run, one for each pass a GeometryInstance3D's fade can draw it in.
 */
interface BuiltTextRun {
  geometry: THREE.BufferGeometry;
  paint: (blend: SurfaceBlend | undefined, shading: SurfaceShading | undefined) => THREE.Material;
  heldTexture?: THREE.Texture;
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

/** How a run samples the raster it owns: its filter row, and whether a mip chain is built for it. */
interface RasterSampling {
  textureFilter: TextureFilterState;
  mipmapped: boolean;
}

/**
 * Writes `sampling` onto an owned raster. No chain unless the caller asks: Godot builds one only
 * for a font with `generate_mipmaps` (`text_server_adv.cpp:3121`), and a raster rebuilt on every
 * text or size change is costly to mipmap.
 */
function sampleRaster(texture: THREE.Texture, { textureFilter, mipmapped }: RasterSampling): void {
  texture.generateMipmaps = mipmapped;
  applyTextureFilterState(texture, textureFilter);
}

/**
 * The texture of a painted raster, its first row at the top as a canvas's is. A blank one the
 * raster's size where the document has no 2D context.
 */
function rasterTexture(
  raster: ImageData | null,
  { canvasWidthPx, canvasHeightPx }: CanvasTextCanvasLayout
): THREE.DataTexture {
  const data = raster
    ? new Uint8Array(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength)
    : new Uint8Array(canvasWidthPx * canvasHeightPx * 4);
  const texture = new THREE.DataTexture(data, canvasWidthPx, canvasHeightPx);
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
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
 * Written only by `sheetTexture`: one texture for each sheet, sampling and colour space, which every
 * run of the sheet shares, as Godot shares a font's page texture. Each run holds it through
 * `useDisposeOnRelease`: the last run to let go disposes it, and three uploads it again for a later run.
 */
const sheetTextures = perObject((_sheet: FillSheet) => new Map<string, THREE.DataTexture>());

/** The shared texture of `sheet`, decoded from sRGB when its material multiplies in linear. */
function sheetTexture(
  sheet: FillSheet,
  sampling: RasterSampling,
  multipliesInLinear: boolean
): THREE.DataTexture {
  const { magFilter, minFilter, generateMipmaps, anisotropy } = sampling.textureFilter;
  const key = [
    multipliesInLinear,
    sampling.mipmapped,
    magFilter,
    minFilter,
    generateMipmaps,
    anisotropy,
  ].join('|');
  const textures = sheetTextures(sheet);
  let texture = textures.get(key);
  if (!texture) {
    texture = createSheetTexture(sheet);
    if (multipliesInLinear) texture.colorSpace = THREE.SRGBColorSpace;
    sampleRaster(texture, sampling);
    textures.set(key, texture);
  }
  return texture;
}

/**
 * A BMFont run: one quad for each glyph over a texture of the font's page fills. The tint multiplies
 * the page colour as Godot's modulate does for a font with no FreeType face (`text_server_adv.cpp:4045`),
 * in sRGB for a Control and in linear for a Label3D (`glyphDrawer.ts`). A positive `strokeWidthPx`
 * draws the outline set at the glyph's own rectangle (`text_server_adv.h:406-414`, `font.cpp:1712-1717`).
 */
function buildBitmapRun(
  layout: TextLayoutResult,
  metrics: BitmapFontMetrics,
  fontSizePx: number,
  look: TextRunLook,
  sampling: RasterSampling,
  { strokeWidthPx = 0, glyphDrawer = 'canvasItem', originPhasePx }: CanvasTextPaintOptions
): BuiltTextRun {
  const { tint, clippingPlanes, depthTest, side, pixelMaterial } = look;
  const isOutlinePass = strokeWidthPx > 0;
  const sheet = isOutlinePass ? metrics.bitmap.outlineSheet : metrics.bitmap.sheet;
  const quads = buildBitmapQuads(layout, metrics, fontSizePx, sheet, { glyphDrawer, originPhasePx });
  const geometry = quadGeometry(quads);
  geometry.setAttribute('normal', quadFacingPlusZ(quads.positions.length / 3));
  const { multipliesInLinear } = GLYPH_DRAWER_RULES[glyphDrawer];
  const texture = sheetTexture(sheet, sampling, multipliesInLinear);
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
      mipmapped: sampling.mipmapped,
      shading,
      ...blend,
    });
  return { geometry, paint, heldTexture: texture };
}

/**
 * Dispatches on `layout.fontMetrics.kind`, so no slice's `Component.tsx` branches. The face sets the
 * shear (`FontMetrics.skew`). The atlas branch ignores `canvasPaint`. A BMFont run reads its
 * stroke width as its outline pass, and its origin phase as a canvas run does.
 */
function buildTextRun(
  layout: TextLayoutResult,
  fontSizePx: number,
  look: TextRunLook,
  canvasPaint: CanvasTextPaintOptions,
  sampling: RasterSampling
): BuiltTextRun {
  const { tint, clippingPlanes, depthTest, side, pixelMaterial } = look;
  const skew = layout.fontMetrics.skew ?? 0;
  if (isBitmapFontMetrics(layout.fontMetrics)) {
    return buildBitmapRun(layout, layout.fontMetrics, fontSizePx, look, sampling, canvasPaint);
  }
  if (isCanvasFontMetrics(layout.fontMetrics)) {
    const canvasLayout = computeCanvasTextCanvasLayout(
      layout,
      skew,
      canvasPaint.strokeWidthPx,
      canvasPaint.originPhasePx
    );
    const quads = buildCanvasTextQuadArrays(canvasLayout, canvasPaint.originPhasePx);
    const geo = quadGeometry(quads);
    const { positions } = quads;
    // On every run, so toggling the shading rebuilds the material alone, not the raster.
    geo.setAttribute('normal', quadFacingPlusZ(positions.length / 3));

    const raster = paintSceneFontCanvas(layout, fontSizePx, tint, skew, canvasLayout, canvasPaint);
    const texture = rasterTexture(raster, canvasLayout);
    // `SRGBColorSpace`, not the 2D-canvas rule's `NoColorSpace`: measured, `NoColorSpace` dips
    // 5/255 below the backdrop at a glyph edge, where Godot draws a monotonic ramp. `textRun.md`
    // gives the engine lines.
    texture.colorSpace = THREE.SRGBColorSpace;
    sampleRaster(texture, sampling);
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
        mipmapped: sampling.mipmapped,
        shading,
        ...blend,
      });
    return { geometry: geo, paint, heldTexture: texture };
  }

  const geo = quadGeometry(buildGlyphQuadArrays(layout, fontSizePx, skew));

  const [r, g, b] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
  const options = {
    map: getAtlasTexture(),
    color: { r, g, b },
    opacity: tint.a,
    pxRange: OPEN_SANS_ATLAS_INFO.distanceRange,
    clippingPlanes,
    depthTest,
    side,
    pixelMaterial,
  };
  // The atlas painter has no blend modes: only a canvas run takes `blends`.
  return { geometry: geo, paint: () => createMsdfMaterial(options) };
}

/** Draws `props.layout` on the painter its face's `kind` names. `TextRun.tsx` routes a run here. */
export function TextRunMesh({
  layout,
  fontSizePx,
  tint,
  clippingPlanes,
  renderOrder = 0,
  depthTest,
  side,
  strokeWidthPx = 0,
  glyphDrawer = 'canvasItem',
  textureFilter = godotTextureFilterState(undefined),
  mipmapped = false,
  blends,
  shadow,
  layers,
  frameExcluded,
  shading,
  instance,
}: TextRunProps) {
  const swapped = useSwappedMaterials(undefined);
  const pixelMaterial = useCanvasItemPixelMaterial();
  // The run memo keys by the phase, so a run that moves by whole pixels keeps its raster. An atlas
  // run and a run that keeps its pen read no phase, so a move never rebuilds them.
  const itemOrigin = useCanvasItemOrigin();
  const { fontMetrics } = layout;
  const readsPhase = isBitmapFontMetrics(fontMetrics)
    ? bitmapFloorsPen(glyphDrawer, fontSizePx, fontMetrics)
    : isCanvasFontMetrics(fontMetrics) && snapsGlyphsToItemPixels(glyphDrawer, fontSizePx, fontMetrics);
  const { x: phaseX, y: phaseY } = readsPhase ? originPhase(itemOrigin) : VECTOR2_ZERO;
  if (blends && !swapped)
    throw new Error('expected blends only inside a GeometryInstance3D drawer, got none');

  const run = useMemo(
    () =>
      buildTextRun(
        layout,
        fontSizePx,
        { tint, clippingPlanes, depthTest, side, pixelMaterial },
        { strokeWidthPx, glyphDrawer, originPhasePx: { x: phaseX, y: phaseY } },
        { textureFilter, mipmapped }
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
      glyphDrawer,
      phaseX,
      phaseY,
      textureFilter,
      mipmapped,
    ]
  );
  const material = usePaintedMaterial(run, blends?.unfaded, shading);
  const alphaPassMaterial = useAlphaPassMaterial(run, blends?.alphaPass, shading);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const isOverridden = instance?.isOverridden === true;
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!swapped || !alphaPassMaterial || !mesh || isOverridden) return;
    const detachUnfaded = swapped.unfaded(mesh, material);
    const detachAlphaPass = swapped.alphaPass(mesh, alphaPassMaterial);
    return () => {
      detachAlphaPass();
      detachUnfaded();
    };
  }, [swapped, material, alphaPassMaterial, isOverridden]);

  // R3F does not dispose a geometry or material passed as a prop, so both leak
  // on every rebuild without this, and a Label re-shapes on every rect or font change.
  useDisposeOnRelease(run.geometry);
  // A canvas raster is fresh per rebuild, and a BMFont sheet texture is shared by its runs.
  useDisposeOnRelease(run.heldTexture);
  useNearestAnisotropy(run.heldTexture ?? null);

  // `draw_hex_code_box` (`text_server.cpp:771-812`) draws in its caller's colour:
  // this run's `tint`, converted to linear once as for every `ControlQuad`.
  const hexBoxRects = useMemo(
    () =>
      GLYPH_DRAWER_RULES[glyphDrawer].drawsHexCodeBoxes ? collectHexCodeBoxRects(layout, fontSizePx) : [],
    [glyphDrawer, layout, fontSizePx]
  );
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
      {!run.heldTexture && <AtlasPending />}
      <mesh
        ref={meshRef}
        geometry={run.geometry}
        // A faded run's materials go on through the swap alone, which the fade owns.
        material={alphaPassMaterial || isOverridden ? undefined : material}
        renderOrder={renderOrder}
        userData={userData}
        castShadow={shadow?.castShadow}
        // An override is lit as its own material says, which its program decides.
        receiveShadow={shading !== undefined || isOverridden}
        onBeforeRender={shadow?.onBeforeRender}
        onAfterRender={shadow?.onAfterRender}
        onBeforeShadow={shadow?.onBeforeShadow}
        onAfterShadow={shadow?.onAfterShadow}
      >
        {instance?.passes(meshRef)}
      </mesh>
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
