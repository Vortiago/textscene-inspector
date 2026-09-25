/**
 * Label3D's glyph-drawing pass, `React.lazy`-loaded so the font stays out of the
 * initial bundle. Shaped with `'canvas'` metrics, not MSDF: Godot's default font is
 * not MSDF (`servers/text/text_server.cpp:2386`, read by `scene/theme/theme_db.cpp:59`),
 * and a distance field cannot reach as far as the FreeType outline.
 */
import { useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  AutowrapMode,
  shapeText,
  soloLineLayout,
} from '../../../r3f/controls/native/text/textLayout';
import { TextRun } from '../../../r3f/controls/native/text/TextRun';
import {
  onSceneFontMetricsSettled,
  peekBundledCanvasFontMetrics,
} from '../../../r3f/controls/native/text/sceneFontLoader';
import type { CanvasTextTransparency } from '../../../r3f/controls/native/text/canvasTextPainter';
import { alphaCutSurface, NO_TRANSPARENT_FLAG } from '../../../r3f/godotAlphaCut';
import { usePendingWhile } from '../../../resources/usePendingWhile';
import { layoutLabel3DLines, outlineStrokeWidthPx } from './glyphLayout';
import { AlphaCutMode, TextureFilter, type Label3DProperties } from './types';

export interface LabelGlyphsProps {
  properties: Label3DProperties;
}

export default function LabelGlyphs({ properties }: LabelGlyphsProps) {
  // `undefined` until `document.fonts` has the bundled family; the
  // subscription is what re-renders once it does.
  const fontMetrics = useSyncExternalStore(
    onSceneFontMetricsSettled,
    peekBundledCanvasFontMetrics,
    peekBundledCanvasFontMetrics
  );
  usePendingWhile(!fontMetrics);

  const layout = useMemo(
    () =>
      // Godot breaks the paragraph on `\n` only: `width` is unparsed, so autowrap
      // is off, and `shapeText` ignores `boxWidthPx` for OFF.
      shapeText(properties.text, {
        fontSizePx: properties.font_size,
        boxWidthPx: 0,
        autowrapMode: AutowrapMode.OFF,
        lineSpacingPx: properties.line_spacing,
        fontMetrics,
      }),
    [properties.text, properties.font_size, properties.line_spacing, fontMetrics]
  );

  // One `<TextRun>` per line: Godot aligns each line by its own width
  // (`label_3d.cpp:588-599`).
  const placements = useMemo(
    () =>
      layoutLabel3DLines(layout, properties.horizontal_alignment, properties.line_spacing),
    [layout, properties.horizontal_alignment, properties.line_spacing]
  );

  // Memoised: `TextRun` keys its geometry and material off this object's
  // identity, so a fresh one re-meshes every line on every render. Both surfaces
  // of a line share one, which registers their ink, since each pads differently.
  const lineLayouts = useMemo(
    () => placements.map((placement) => soloLineLayout(placement.line, layout)),
    [placements, layout]
  );

  const depthTest = !properties.no_depth_test;
  const side = properties.double_sided === false ? THREE.FrontSide : THREE.DoubleSide;

  // `label_3d.cpp:610`. The outline is a second, stroked run drawn first. Both runs
  // are `TRANSPARENCY_ALPHA` (`label_3d.cpp:386`) on one cached shader (`:396`),
  // `blend_mix, depth_draw_opaque` (`material.cpp:775-812`), sorted ascending by
  // `material_set_render_priority` (`:402`), which three's `renderOrder` matches.
  const drawOutline = properties.outline_size > 0 && properties.outline_modulate.a !== 0;
  const strokeWidthPx = drawOutline ? outlineStrokeWidthPx(properties.outline_size) : 0;

  // `label_3d.cpp:401-405`: only an ALPHA_CUT_DISABLED surface is sorted by its
  // material's render priority. Any other mode bakes `priority * pixel_size` into
  // the vertex Z (`:417-420`), and in Godot px inside `Component.tsx`'s
  // `pixel_size` group the shift is the bare priority.
  const sortedByPriority = properties.alpha_cut === AlphaCutMode.DISABLED;
  const surface = (priority: number) => ({
    renderOrder: sortedByPriority ? priority : 0,
    zShiftPx: sortedByPriority ? 0 : priority,
  });
  const outlineSurface = surface(properties.outline_render_priority);
  const fillSurface = surface(properties.render_priority);

  // Not memoised: `TextRun` keys its material off this object's fields, not its
  // identity, so a fresh equal-valued one rebuilds nothing.
  const cut = alphaCutSurface({
    mode: properties.alpha_cut,
    scissorThreshold: properties.alpha_scissor_threshold,
    // Label3D's DrawFlags have no FLAG_TRANSPARENT (`label_3d.h:42-47`).
    transparentFlag: NO_TRANSPARENT_FLAG,
  });
  // `label_3d.cpp:386` never gates on modulate alpha: whatever reaches the
  // blended pass is transparent.
  const transparency: CanvasTextTransparency = {
    transparent: cut.blended,
    depthWrite: cut.depthWrite,
    alphaTest: cut.alphaTest,
    alphaHash: cut.alphaHash,
  };

  // `material.h:172-177`: the enum alternates NEAREST, LINEAR, so the even
  // members are the nearest ones whatever their mipmap/anisotropy suffix.
  const textureFilter = properties.texture_filter % 2 === TextureFilter.NEAREST ? 'nearest' : 'linear';

  // Nothing renders before the family registers: `ctx.fillText` against an
  // unregistered one rasterises a system font, frame-stable, so no golden catches it.
  if (!fontMetrics) return null;

  // `modulate` is authored sRGB. Godot decodes the vertex colour (`label_3d.cpp:428`)
  // through `FLAG_SRGB_VERTEX_COLOR` (`material.cpp:3048-3049`, `material.cpp:1218`).
  // Here the tint is baked as sRGB bytes that the texture's `SRGBColorSpace` decodes.
  // `frameExcluded`: Godot's framing camera never sees shaped text (`LABEL3D_BOUNDS_PROXY`).
  return (
    <>
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
                  depthTest={depthTest}
                  side={side}
                  renderOrder={outlineSurface.renderOrder}
                  textureFilter={textureFilter}
                  transparency={transparency}
                  frameExcluded
                />
              </group>
            )}
            <group position={[0, 0, fillSurface.zShiftPx]}>
              <TextRun
                layout={lineLayouts[index]!}
                fontSizePx={properties.font_size}
                tint={properties.modulate}
                depthTest={depthTest}
                side={side}
                renderOrder={fillSurface.renderOrder}
                textureFilter={textureFilter}
                transparency={transparency}
                frameExcluded
              />
            </group>
          </group>
        );
      })}
    </>
  );
}
