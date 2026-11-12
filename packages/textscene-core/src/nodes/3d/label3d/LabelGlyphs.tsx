/**
 * Label3D's glyph-drawing pass, `React.lazy`-loaded so the font stays out of the
 * initial bundle. Shaped with `'canvas'` metrics, or `'bitmap'` for a BMFont: Godot's
 * default font is not MSDF (`servers/text/text_server.cpp:2386`, read by `scene/theme/theme_db.cpp:59`),
 * and a distance field cannot reach as far as the FreeType outline.
 */
import { useMemo, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { soloLineLayout } from '../../../r3f/controls/native/text/textLayout';
import { TextRun, type TextRunProps } from '../../../r3f/controls/native/text/TextRun';
import { NO_TRANSPARENT_FLAG } from '../../../r3f/godotAlphaCut';
import { useAnisotropicFilteringLevel } from '../../../r3f/contexts/AnisotropicFilteringContext';
import { materialFor2d } from '../../../r3f/materialFor2d';
import { usePendingWhile } from '../../../resources/usePendingWhile';
import { useGeometryInstance, useInstanceDraw } from '../../../r3f/visibilityRange/geometryInstance';
import { InstancePasses } from '../../../r3f/materials/InstancePasses';
import { authoredPlacement, UNPLACED } from '../../../r3f/visibilityRange/placements';
import { labelBillboardAabb } from '../../../godot/scene/billboard';
import { breakLabel3DLines, justifyLabel3DLines, label3DAabb, layoutLabel3DLines } from './glyphLayout';
import { outlineStrokeWidthPx } from '../../../r3f/controls/native/text/textOutline';
import { AutowrapMode } from '../../../godot/text/textServerEnums';
import { type Label3DProperties } from './types';
import { useLabel3DFont } from './useLabel3DFont';
import { useLayoutDirectionEnv } from '../../../r3f/contexts/useLayoutDirectionEnv';
import { textBidiOptions } from '../../../r3f/controls/native/text/textBidiOptions';
import { AlphaCutMode } from '../../../godot/rendering/materials/alphaCut';

export interface LabelGlyphsProps {
  /** The label's node group, whose parent places it for the scene cull. */
  nodeRef: RefObject<THREE.Object3D | null>;
  /** `nodeRef` while the glyph material's billboard or `fixed_size` moves it (`useOwnMaterialPose`). */
  posedRef?: RefObject<THREE.Object3D | null>;
  properties: Label3DProperties;
}

export default function LabelGlyphs({ nodeRef, posedRef, properties }: LabelGlyphsProps) {
  // `label_3d.cpp:610`. The outline is a second, stroked run drawn first. Both runs
  // are `TRANSPARENCY_ALPHA` (`label_3d.cpp:386`) on one cached shader (`:396`),
  // `blend_mix, depth_draw_opaque` (`material.cpp:775-812`), sorted ascending by
  // `material_set_render_priority` (`:402`), which three's `renderOrder` matches.
  const drawOutline = properties.outline_size > 0 && properties.outline_modulate.a !== 0;
  const strokeWidthPx = drawOutline ? outlineStrokeWidthPx(properties.outline_size) : 0;

  // Undefined while the font loads. The hook re-renders once it has.
  const font = useLabel3DFont(properties.font);
  const fontMetrics = font?.metrics;
  usePendingWhile(font === undefined);

  // Each memo lists the fields it reads, so an unrelated property edit keeps the layout.
  const { text, font_size, line_spacing, width, autowrap_mode, autowrap_trim_flags } = properties;
  const { justification_flags, horizontal_alignment, vertical_alignment, uppercase } = properties;
  const { textDirection, language, structuredTextBidiOverride, structuredTextBidiOverrideOptions } =
    properties;
  const locale = useLayoutDirectionEnv().applicationLocale;
  // An empty `language` takes the project's `_get_locale()` (`label_3d.cpp:483`).
  const bidi = useMemo(
    () =>
      textBidiOptions(
        { textDirection, language, structuredTextBidiOverride, structuredTextBidiOverrideOptions },
        locale
      ),
    [textDirection, language, structuredTextBidiOverride, structuredTextBidiOverrideOptions, locale]
  );
  const { x: offsetX, y: offsetY } = properties.offset;
  // Width reaches the break only in a wrapping mode, so it is 0 otherwise: `shapeText` ignores it for OFF.
  const breakWidth = autowrap_mode === AutowrapMode.AUTOWRAP_OFF ? 0 : width;
  const broken = useMemo(
    () =>
      breakLabel3DLines(
        { text, font_size, line_spacing, width: breakWidth, autowrap_mode, autowrap_trim_flags, uppercase },
        bidi,
        fontMetrics
      ),
    [
      text,
      font_size,
      line_spacing,
      breakWidth,
      autowrap_mode,
      autowrap_trim_flags,
      uppercase,
      bidi,
      fontMetrics,
    ]
  );
  const layout = useMemo(
    () => justifyLabel3DLines(broken, { width, justification_flags, horizontal_alignment }),
    [broken, width, justification_flags, horizontal_alignment]
  );

  // One `<TextRun>` per line: Godot aligns each line by its own width
  // (`label_3d.cpp:588-599`).
  const placements = useMemo(
    () =>
      layoutLabel3DLines(layout, {
        horizontal_alignment,
        vertical_alignment,
        line_spacing,
        offset: { x: offsetX, y: offsetY },
      }),
    [layout, horizontal_alignment, vertical_alignment, line_spacing, offsetX, offsetY]
  );

  // Memoised: `TextRun` keys its geometry and material off this object's
  // identity, so a fresh one re-meshes every line on every render. Both surfaces
  // of a line share one, which registers their ink, since each pads differently.
  const lineLayouts = useMemo(
    () => placements.map((placement) => soloLineLayout(placement.line, layout)),
    [placements, layout]
  );

  // The shaped text decides the box, so a font still loading leaves the label unplaced.
  const placement = useMemo(() => {
    if (!fontMetrics) return UNPLACED;
    const aabb = label3DAabb(placements, layout.linePitchPx, properties.pixel_size);
    return authoredPlacement(nodeRef, properties.transform, labelBillboardAabb(aabb, properties.billboard));
  }, [
    fontMetrics,
    nodeRef,
    placements,
    layout.linePitchPx,
    properties.pixel_size,
    properties.transform,
    properties.billboard,
  ]);
  useGeometryInstance(placement);
  const { shadow, override, overlay } = useInstanceDraw();
  const isOverridden = override !== undefined;
  // An instance material fills the mesh Godot holds, one quad for each glyph (`label_3d.cpp:417-420`),
  // where the glyph material draws the raster of the line.
  const glyphQuads: TextRunProps['glyphQuads'] = isOverridden ? 'base' : overlay ? 'extraDraws' : undefined;

  // Not memoised: `TextRun` keys its material off the blend's fields, not its identity, so a fresh
  // equal-valued one rebuilds nothing.
  const anisotropicFilteringLevel = useAnisotropicFilteringLevel();
  const { blends, joinsShadowPass, shading, side, depthTest, textureFilter } = materialFor2d({
    alphaCut: properties.alpha_cut,
    alphaScissorThreshold: properties.alpha_scissor_threshold,
    // Label3D's DrawFlags have no FLAG_TRANSPARENT (`label_3d.h:42-47`).
    transparentFlag: NO_TRANSPARENT_FLAG,
    alphaHashScale: properties.alpha_hash_scale,
    alphaAntialiasingMode: properties.alpha_antialiasing_mode,
    alphaAntialiasingEdge: properties.alpha_antialiasing_edge,
    doubleSided: properties.double_sided,
    noDepthTest: properties.no_depth_test,
    shaded: properties.shaded,
    textureFilter: properties.texture_filter,
    anisotropicFilteringLevel,
  });
  // The glyph pages carry a mip chain only for a font with `generate_mipmaps`; the filter row
  // says whether a mipmapped sampler reads it.
  const mipmapped = font?.generatesMipmaps ?? false;
  // Both surfaces take one material (`label_3d.cpp:396`), so they share these props.
  const surfaceProps = {
    glyphDrawer: 'label3D' as const,
    depthTest,
    side,
    textureFilter,
    mipmapped,
    fallbackMipmaps: font?.fallbackMipmaps,
    blends,
    glyphQuads,
    // The material that draws decides the shadow pass: an override's own draw hooks answer for it.
    shadow: { ...shadow, castShadow: shadow.castShadow && (joinsShadowPass || isOverridden) },
    layers: properties.layers,
    shading,
    // An override is lit as its own material says, which its program decides.
    receiveShadow: shading !== undefined || isOverridden,
  };

  // `label_3d.cpp:401-405`: only an ALPHA_CUT_DISABLED surface is sorted by its
  // material's render priority, which an override replaces with its own. Any other mode
  // bakes `priority * pixel_size` into the vertex Z (`:417-420`), and in Godot px inside
  // `Component.tsx`'s `pixel_size` group the shift is the bare priority.
  const bakesPriority = properties.alpha_cut !== AlphaCutMode.DISABLED;
  const sortsByPriority = !bakesPriority && !isOverridden;
  const surface = (priority: number, laterSurfaces: number) => ({
    renderOrder: sortsByPriority ? priority : 0,
    zShiftPx: bakesPriority ? priority : 0,
    instancePasses: (
      meshRef: RefObject<THREE.Mesh | null>,
      ownMaterial: ReactNode,
      glyphGeometry: THREE.BufferGeometry | undefined
    ) => (
      <InstancePasses
        meshRef={meshRef}
        posedRef={posedRef}
        laterSurfaces={laterSurfaces}
        ownMaterial={ownMaterial}
        overlayGeometry={glyphGeometry}
      />
    ),
  });
  // The outline is the mesh's first surface and the fill its second (`label_3d.cpp:610-615`).
  const outlineSurface = surface(properties.outline_render_priority, 1);
  const fillSurface = surface(properties.render_priority, 0);

  // Nothing renders while the font or its outlines load, or for outlines that cannot be read: no
  // glyph draws against the wrong face.
  if (!fontMetrics) return null;

  // `modulate` is authored sRGB. Godot decodes the vertex colour (`label_3d.cpp:428`)
  // through `FLAG_SRGB_VERTEX_COLOR` (`material.cpp:3048-3049`, `material.cpp:1218`).
  // A canvas run bakes the tint as sRGB bytes that the texture's `SRGBColorSpace` decodes, and a
  // BMFont run multiplies the decoded page by the linear tint.
  // `frameExcluded`: Godot's framing camera never sees shaped text (`FramePoint` in `label3d/Component.tsx`).
  return (
    <group>
      {placements.map((placement, index) => {
        return (
          <group key={index} position={[placement.x, -placement.y, 0]}>
            {drawOutline && (
              <group position={[0, 0, outlineSurface.zShiftPx]}>
                <TextRun
                  layout={lineLayouts[index]!}
                  fontSizePx={properties.font_size}
                  tint={properties.outline_modulate}
                  strokeWidthPx={strokeWidthPx}
                  renderOrder={outlineSurface.renderOrder}
                  instancePasses={outlineSurface.instancePasses}
                  {...surfaceProps}
                  frameExcluded
                />
              </group>
            )}
            <group position={[0, 0, fillSurface.zShiftPx]}>
              <TextRun
                layout={lineLayouts[index]!}
                fontSizePx={properties.font_size}
                tint={properties.modulate}
                renderOrder={fillSurface.renderOrder}
                instancePasses={fillSurface.instancePasses}
                {...surfaceProps}
                frameExcluded
              />
            </group>
          </group>
        );
      })}
    </group>
  );
}
