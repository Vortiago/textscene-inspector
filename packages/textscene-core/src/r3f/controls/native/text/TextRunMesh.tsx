/**
 * The mesh of one `shapeText` layout: every visible glyph on every line as one
 * `THREE.BufferGeometry` and material. `TextRun.tsx` routes each run here, and
 * `layout.fontMetrics.kind` picks the painter: `canvasTextPainter.ts`'s single raster quad for
 * `'canvas'`, and `bitmapTextPainter.ts`'s quad for each glyph of a BMFont for `'bitmap'`. Both
 * place a line by its box-top Y alone, and its baseline `layout.baselineOffsetPx` below that, as
 * Godot's `ofs.y += asc` does (`scene/gui/label.cpp:616,823`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { visualLayersUserData } from '../../../visualLayers';
import * as THREE from 'three';
import {
  useCanvasItemPixelMaterial,
  type CanvasItemPixelMaterial,
} from '../../../components/LitCanvasItemPixels';
import {
  canvasGlyphRects,
  computeCanvasTextCanvasLayout,
  buildCanvasGlyphQuadArrays,
  buildCanvasTextQuadArrays,
  type CanvasTextQuadArrays,
  paintSceneFontCanvas,
  createCanvasTextMaterial,
  originPhase,
  type CanvasTextCanvasLayout,
  type CanvasTextPaintOptions,
} from './canvasTextPainter';
import type { SurfaceShading } from '../../../materialFor2d';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import { isBitmapFontMetrics, type BitmapFontMetrics } from './bitmapFontMetrics';
import { buildBitmapQuads, createSheetTexture } from './bitmapTextPainter';
import type { FillSheet } from '../../../../resources/fonts/font/types';
import { perObject } from '../../../../utils/perObject';
import { GLYPH_DRAWER_RULES, snapsPen, type GlyphDrawer } from './glyphDrawer';
import type { TextLayoutResult } from './textLayout';
import { hexCodeBoxRects } from './hexCodeBox';
import { CanvasItemGroup, useCanvasItemOrigin } from '../../../components/CanvasItemGroup';
import { ControlQuad } from '../controlQuad';
import {
  applyTextureFilterState,
  godotTextureFilterState,
  type TextureFilterState,
} from '../../../../resources/textures/godotTextureFilter';
import { useItemLinearColor, useOwnModulate, WHITE_MODULATE } from '../../../canvasItemModulate';
import { drawsColourGlyphs } from './colour/colourGlyphs';
import { useSvgGlyphLandings } from './svg/useSvgGlyphLandings';
import type { FontMetrics } from './fontMetrics';
import { useCanvasColorSpace } from '../../../canvasColorSpace';
import type { SurfaceBlend } from '../../../materials/surfaceBlend';
import type { FadeVariants } from '../../../materials/fadeVariants';
import { useSwappedMaterials } from '../../../materials/swappedMaterials';
import type { ShadowCastingEffects } from '../../../shadowCasting';
import type { Rgba } from '../../../../godot/math/math';
import { VECTOR2_ZERO } from '../../../../godot/math/vector';
import { useDisposeOnRelease } from '../../../useDisposeOnRelease';
import { useNearestAnisotropy } from '../../../nearestAnisotropy';
import { vertexColourAttribute } from '../../../vertexColour';

/** One rectangle of a hex-code box in local Godot px, +Y down, before the Y negation into three's space. */
interface HexCodeBoxAbsoluteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Every `hexCodeBoxRects` rectangle for every `controlCodepoint` placement, moved
 * from pen-relative space to the line's box-top space at the baseline of its line, since the box
 * replaces that glyph's ink.
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
  /** Must match the `fontSizePx` the layout was shaped at. */
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
  /** Forwarded to the material. Omitted, the material's `false` stays. */
  depthTest?: boolean;
  /** Forwarded to the material. Omitted, `canvasItemFacing()`'s side stays. The run draws in one pass. */
  side?: THREE.Side;
  /**
   * Paints a stroked outline ring of this width (CSS px) instead of the fill, as
   * Godot's separate outline surface (`label_3d.cpp:610-615`) at the same pen
   * positions. The default 0 fills.
   */
  strokeWidthPx?: number;
  /**
   * The Godot code that draws the glyphs, `'canvasItem'` by default (`glyphDrawer.ts`). A canvas item
   * places each glyph at the run's place in the item (`useCanvasItemOrigin`): the pen on its subpixel
   * step and the baseline on a whole pixel (`text_server_adv.cpp:4074-4084`). Label3D passes `'label3D'`,
   * whose mesh keeps both, skips small glyphs and draws no hex-code box.
   */
  glyphDrawer?: GlyphDrawer;
  /**
   * The raster texture's sampler: Label3D's `texture_filter` (`label_3d.h:140`). The default is
   * Godot's default filter. A mipmapped row samples a mip chain only where `mipmapped` built one.
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
   * as a shaded Label3D (`material.cpp:3045`). The quad faces +Z (`label_3d.cpp:422-423`).
   * Omitted, unlit.
   */
  shading?: SurfaceShading;
  /**
   * The `BaseMaterial3D::Transparency` this surface paints in, from a 3D caller's
   * `alpha_cut` (`label_3d.cpp:386-393`), in each pass its GeometryInstance3D's fade can draw it
   * in. Runs inside a GeometryInstance3D drawer only. Omitted, it paints
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
   * What the GeometryInstance3D the run draws for mounts inside the run's mesh (Label3D only):
   * its passes, which decide whether `ownMaterial` draws. `glyphGeometry` is the mesh `glyphQuads`
   * asks for. Omitted, the run mounts its own material.
   */
  instancePasses?: (
    meshRef: RefObject<THREE.Mesh | null>,
    ownMaterial: ReactNode,
    glyphGeometry: THREE.BufferGeometry | undefined
  ) => ReactNode;
  /**
   * Builds the mesh Godot's Label3D holds, one quad for each glyph with the tint as its vertex
   * colour (`label_3d.cpp:417-437`), for a material that is not the run's own (Label3D only).
   * `'base'` draws it in place of the run's geometry, as a `material_override` fills it.
   * `'extraDraws'` hands it to `instancePasses` alone, as a `material_overlay` fills it over the run.
   */
  glyphQuads?: 'base' | 'extraDraws';
  /** Whether the mesh receives shadows. By default a shaded run does. */
  receiveShadow?: boolean;
}

/**
 * The run's own material on its mesh. A run a GeometryInstance3D fades mounts its unfaded and
 * alpha-pass pair through the swap, which the fade owns.
 */
function RunMaterials({
  material,
  alphaPassMaterial,
}: {
  material: THREE.Material;
  alphaPassMaterial: THREE.Material | null;
}) {
  const swapped = useSwappedMaterials(undefined);
  if (!swapped || !alphaPassMaterial) return <primitive object={material} attach="material" />;
  return (
    <>
      <primitive object={material} attach={swapped.unfaded} />
      <primitive object={alphaPassMaterial} attach={swapped.alphaPass} />
    </>
  );
}

/** The normal +Z on each of `vertexCount` vertices, which only a lit material reads. */
function quadFacingPlusZ(vertexCount: number): THREE.BufferAttribute {
  const normals = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) normals[i * 3 + 2] = 1;
  return new THREE.BufferAttribute(normals, 3);
}

/** What `createCanvasTextMaterial` builds for either painter: a lit run takes the standard one. */
type TextRunMaterial = THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;

/**
 * One built run: its geometry, and the texture this component holds and the last holder disposes.
 * `paint` builds a material for the run, one for each pass a GeometryInstance3D's fade can draw it in.
 */
interface BuiltTextRun {
  geometry: THREE.BufferGeometry;
  /**
   * Builds one quad for each glyph with the tint as its vertex colour, which the caller disposes.
   * A BMFont run answers its `geometry`, which holds a quad for each glyph already.
   */
  buildGlyphGeometry: () => THREE.BufferGeometry;
  paint: (blend: SurfaceBlend | undefined, shading: SurfaceShading | undefined) => TextRunMaterial;
  heldTexture: THREE.Texture;
}

/** What both painters' materials read, apart from the blend. */
interface TextRunLook {
  tint: Rgba;
  clippingPlanes: readonly THREE.Plane[] | undefined;
  depthTest: boolean | undefined;
  side: THREE.Side | undefined;
  /** The lit Control around the run, or undefined for a run no 2D light reaches, such as Label3D's. */
  pixelMaterial: CanvasItemPixelMaterial | undefined;
  /** `tint` as the item draws it, in linear (`useItemLinearColor`), for the BMFont painter. */
  linearTint: THREE.Color;
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

/**
 * The geometry of merged glyph quads, each facing +Z (`label_3d.cpp:422-423`). Every run holds the
 * normal, which only a lit material reads, so toggling the shading rebuilds the material alone.
 */
function quadGeometry({ positions, uvs, indices }: CanvasTextQuadArrays): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', quadFacingPlusZ(positions.length / 3));
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
  const { tint, clippingPlanes, depthTest, side, pixelMaterial, linearTint } = look;
  const isOutlinePass = strokeWidthPx > 0;
  const sheet = isOutlinePass ? metrics.bitmap.outlineSheet : metrics.bitmap.sheet;
  const quads = buildBitmapQuads(layout, metrics, fontSizePx, sheet, { glyphDrawer, originPhasePx });
  const geometry = quadGeometry(quads);
  const { multipliesInLinear } = GLYPH_DRAWER_RULES[glyphDrawer];
  const texture = sheetTexture(sheet, sampling, multipliesInLinear);
  const paint = (blend: SurfaceBlend | undefined, shading: SurfaceShading | undefined) =>
    createCanvasTextMaterial({
      map: texture,
      color: linearTint,
      opacity: tint.a,
      clippingPlanes,
      depthTest,
      side,
      pixelMaterial,
      mipmapped: sampling.mipmapped,
      shading,
      ...blend,
    });
  return {
    geometry,
    buildGlyphGeometry: () => withVertexColour(geometry, tint),
    paint,
    heldTexture: texture,
  };
}

/**
 * A canvas run: one quad over the raster of its glyphs, tinted in the raster. The face sets the
 * shear (`FontMetrics.skew`).
 */
function buildCanvasRun(
  layout: TextLayoutResult,
  fontSizePx: number,
  look: TextRunLook,
  canvasPaint: CanvasTextPaintOptions,
  sampling: RasterSampling
): BuiltTextRun {
  const { tint, clippingPlanes, depthTest, side, pixelMaterial } = look;
  const skew = layout.fontMetrics.skew ?? 0;
  const { strokeWidthPx, originPhasePx } = canvasPaint;
  const canvasLayout = computeCanvasTextCanvasLayout(layout, skew, strokeWidthPx, originPhasePx);
  const geometry = quadGeometry(buildCanvasTextQuadArrays(canvasLayout, originPhasePx));

  const raster = paintSceneFontCanvas(layout, fontSizePx, tint, skew, canvasLayout, canvasPaint);
  const texture = rasterTexture(raster, canvasLayout);
  // `SRGBColorSpace`, not the 2D-canvas rule's `NoColorSpace`: measured, `NoColorSpace` dips
  // 5/255 below the backdrop at a glyph edge, where Godot draws a monotonic ramp. `textRun.md`
  // gives the engine lines.
  texture.colorSpace = THREE.SRGBColorSpace;
  sampleRaster(texture, sampling);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const paint = (blend: SurfaceBlend | undefined, shading: SurfaceShading | undefined) =>
    createCanvasTextMaterial({
      map: texture,
      opacity: tint.a,
      clippingPlanes,
      depthTest,
      side,
      pixelMaterial,
      mipmapped: sampling.mipmapped,
      shading,
      ...blend,
    });
  const buildGlyphGeometry = () => {
    const glyphRects = canvasGlyphRects(layout, fontSizePx, skew, canvasLayout, canvasPaint);
    const glyphQuads = buildCanvasGlyphQuadArrays(glyphRects, canvasLayout, originPhasePx);
    return withVertexColour(quadGeometry(glyphQuads), tint);
  };
  return { geometry, buildGlyphGeometry, paint, heldTexture: texture };
}

/** `glyphGeometry` with `tint` as the vertex colour of its glyph quads (`label_3d.cpp:425-429`). */
function withVertexColour(glyphGeometry: THREE.BufferGeometry, tint: Rgba): THREE.BufferGeometry {
  glyphGeometry.setAttribute(
    'color',
    vertexColourAttribute(glyphGeometry.getAttribute('position').count, tint)
  );
  return glyphGeometry;
}

/**
 * Dispatches on `layout.fontMetrics.kind`, so no slice's `Component.tsx` branches. A BMFont run
 * reads its stroke width as its outline pass, and its origin phase as a canvas run does.
 */
function buildTextRun(
  layout: TextLayoutResult,
  fontSizePx: number,
  look: TextRunLook,
  canvasPaint: CanvasTextPaintOptions,
  sampling: RasterSampling
): BuiltTextRun {
  const { fontMetrics } = layout;
  if (isBitmapFontMetrics(fontMetrics))
    return buildBitmapRun(layout, fontMetrics, fontSizePx, look, sampling, canvasPaint);
  if (isCanvasFontMetrics(fontMetrics))
    return buildCanvasRun(layout, fontSizePx, look, canvasPaint, sampling);
  throw new Error(`expected a canvas or bitmap face, got a ${fontMetrics.kind} face, which TextRun draws`);
}

/**
 * The colour that tints a colour glyph of a run in `tint`: the Control's own modulate, as Godot
 * drops the font colour for one, unless the drawer or the font tints it in full (`glyphDrawer.ts`).
 */
function colourGlyphTintOf(
  glyphDrawer: GlyphDrawer,
  fontMetrics: FontMetrics,
  tint: Rgba,
  ownModulate: Rgba
): Rgba {
  const isTintedInFull =
    GLYPH_DRAWER_RULES[glyphDrawer].tintsColourGlyphs || fontMetrics.outlines?.modulatesColourGlyphs === true;
  return isTintedInFull ? tint : ownModulate;
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
  instancePasses,
  glyphQuads,
  receiveShadow = shading !== undefined,
}: TextRunProps) {
  const swapped = useSwappedMaterials(undefined);
  const pixelMaterial = useCanvasItemPixelMaterial();
  // The run memo keys by the phase, so a run that moves by whole pixels keeps its raster. A run
  // that keeps its pen reads no phase, so a move never rebuilds it.
  const itemOrigin = useCanvasItemOrigin();
  const { fontMetrics } = layout;
  const readsPhase = snapsPen(glyphDrawer, fontSizePx, fontMetrics);
  const { x: phaseX, y: phaseY } = readsPhase ? originPhase(itemOrigin) : VECTOR2_ZERO;
  const linearTint = useItemLinearColor(tint);
  const isLinearCanvas = useCanvasColorSpace().isLinear;
  // Godot's glyph is a white coverage mask that the rect modulate tints (`text_server_adv.cpp`
  // `rasterize_bitmap`). A linear canvas converts that modulate unclamped, so a white raster takes
  // the tint on its material, and a tint change repaints nothing.
  // A colour glyph takes its own colour, so a raster that holds one has every colour baked in.
  const rasterColor =
    isCanvasFontMetrics(fontMetrics) && isLinearCanvas && !drawsColourGlyphs(fontMetrics.outlines)
      ? linearTint
      : null;
  const colourGlyphTint = colourGlyphTintOf(glyphDrawer, fontMetrics, tint, useOwnModulate());
  const builtTint = rasterColor ? { ...WHITE_MODULATE, a: tint.a } : tint;
  const meshTint = isCanvasFontMetrics(fontMetrics) ? null : linearTint;
  if (blends && !swapped)
    throw new Error('expected blends only inside a GeometryInstance3D drawer, got none');
  // A glyph the browser has not drawn yet paints nothing, so each bitmap that lands repaints the run.
  const svgGlyphLandings = useSvgGlyphLandings(fontMetrics);

  const run = useMemo(
    () =>
      buildTextRun(
        layout,
        fontSizePx,
        { tint: builtTint, clippingPlanes, depthTest, side, pixelMaterial, linearTint },
        { strokeWidthPx, glyphDrawer, originPhasePx: { x: phaseX, y: phaseY }, colourGlyphTint },
        { textureFilter, mipmapped }
      ),
    // `tint` is compared by its fields, not by identity: a caller that re-creates an equal
    // object every render must not rebuild the mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per-field comparison, as above.
    [
      layout,
      fontSizePx,
      builtTint.r,
      builtTint.g,
      builtTint.b,
      builtTint.a,
      colourGlyphTint.r,
      colourGlyphTint.g,
      colourGlyphTint.b,
      meshTint,
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
      svgGlyphLandings,
    ]
  );
  // Apart from the run, so a label that gains or loses an instance material keeps its raster.
  const buildsGlyphQuads = glyphQuads !== undefined;
  const glyphGeometry = useMemo(
    () => (buildsGlyphQuads ? run.buildGlyphGeometry() : undefined),
    [run, buildsGlyphQuads]
  );
  const material = usePaintedMaterial(run, blends?.unfaded, shading);
  const alphaPassMaterial = useAlphaPassMaterial(run, blends?.alphaPass, shading);
  useRasterColor(rasterColor, material, alphaPassMaterial);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const ownMaterial = <RunMaterials material={material} alphaPassMaterial={alphaPassMaterial} />;

  // R3F does not dispose a geometry or material passed as a prop, so both leak
  // on every rebuild without this, and a Label re-shapes on every rect or font change.
  useDisposeOnRelease(run.geometry);
  useDisposeOnRelease(glyphGeometry);
  // A canvas raster is fresh per rebuild, and a BMFont sheet texture is shared by its runs.
  useDisposeOnRelease(run.heldTexture);
  useNearestAnisotropy(run.heldTexture);

  // `draw_hex_code_box` (`text_server.cpp:771-812`) draws in its caller's colour, this run's `tint`.
  const hexBoxRects = useMemo(
    () =>
      GLYPH_DRAWER_RULES[glyphDrawer].drawsHexCodeBoxes ? collectHexCodeBoxRects(layout, fontSizePx) : [],
    [glyphDrawer, layout, fontSizePx]
  );
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
      <mesh
        ref={meshRef}
        geometry={glyphQuads === 'base' ? glyphGeometry : run.geometry}
        renderOrder={renderOrder}
        userData={userData}
        castShadow={shadow?.castShadow}
        receiveShadow={receiveShadow}
        onBeforeRender={shadow?.onBeforeRender}
        onAfterRender={shadow?.onAfterRender}
        onBeforeShadow={shadow?.onBeforeShadow}
        onAfterShadow={shadow?.onAfterShadow}
      >
        {instancePasses ? instancePasses(meshRef, ownMaterial, glyphGeometry) : ownMaterial}
      </mesh>
      {hexBoxRects.map((r, i) => (
        <CanvasItemGroup key={i} position={[r.x, -r.y, 0]}>
          <ControlQuad
            width={r.w}
            height={r.h}
            color={linearTint}
            opacity={tint.a}
            renderOrder={renderOrder}
            drawHooks={shadow}
          />
        </CanvasItemGroup>
      ))}
    </>
  );
}

/** Sets the colour a white canvas raster multiplies by on each of its materials, or leaves them white. */
function useRasterColor(
  color: THREE.Color | null,
  material: TextRunMaterial,
  alphaPassMaterial: TextRunMaterial | null
): void {
  useLayoutEffect(() => {
    if (!color) return;
    material.color.copy(color);
    alphaPassMaterial?.color.copy(color);
  }, [color, material, alphaPassMaterial]);
}

/** The run's material for `blend`. */
function usePaintedMaterial(
  run: BuiltTextRun,
  blend: SurfaceBlend | undefined,
  shading: SurfaceShading | undefined
): TextRunMaterial {
  return useOwnedMaterial(run, blend, shading, () => run.paint(blend, shading));
}

/** The run's alpha-pass material, or null for a run that never fades. */
function useAlphaPassMaterial(
  run: BuiltTextRun,
  blend: SurfaceBlend | undefined,
  shading: SurfaceShading | undefined
): TextRunMaterial | null {
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
