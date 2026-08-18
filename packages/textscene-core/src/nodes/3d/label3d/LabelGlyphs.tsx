/**
 * Label3D's glyph-drawing pass — the part of the shared text engine
 * (`r3f/controls/native/text/`) that pulls in the bundled font
 * (`shapeText`, `TextRun`). `Component.tsx` loads this module via
 * `React.lazy` so the font bytes stay out of the initial render bundle — the
 * SAME split `nodes/viewport/subviewport/ControlRasterLayer.tsx` documents
 * for the same reason (an `import()` boundary, not a second
 * shaping/layout implementation: `shapeText` and `TextRun` are reused
 * verbatim, exactly as the 2D Control Label uses them).
 *
 * Shaped and painted against the bundled font's `'canvas'`-kind metrics, not
 * the MSDF atlas the 2D Control text path uses: Godot's default project font
 * is not MSDF (`servers/text/text_server.cpp:2386`, read by
 * `scene/theme/theme_db.cpp:59`), so every glyph in this corpus goes through
 * FreeType, which a distance-field bake cannot represent — the outline alone
 * asks for more reach than the field encodes. Nothing renders until
 * `document.fonts` has the family: `ctx.fillText` against an unregistered
 * one silently rasterises a SYSTEM font, and those pixels are frame-stable,
 * so no golden gate could catch it.
 *
 * One `<TextRun>` per line (`layoutLabel3DLines`), each in its own
 * positioned `<group>` — Godot aligns EVERY LINE of a Label3D independently
 * by its own width (`label_3d.cpp:588-599`), so a single merged multi-line
 * run sharing one x origin cannot express that once lines differ in width,
 * the same reason `nodes/2d/ui/label/Component.tsx` draws one run per line.
 *
 * The outline (`label_3d.cpp:610`: drawn when `outline_modulate.a != 0.0 &&
 * outline_size > 0`) is a SECOND `<TextRun>` on the same line, stroked
 * rather than filled, drawn first. That is Godot's own model: two
 * overlapping surfaces, both `TRANSPARENCY_ALPHA` (`label_3d.cpp:386`) on
 * the same cached shader (`:396`), i.e. `blend_mix, depth_draw_opaque`
 * (`material.cpp:775-812`) — straight alpha-over with no depth write —
 * ordered by `material_set_render_priority` (`:402`) into an ascending sort,
 * which is what three's `renderOrder` gives.
 *
 * `modulate`/`outline_modulate` are AUTHORED sRGB and must reach the tone
 * curve decoded. Godot writes each into the glyph quad's vertex colour
 * (`label_3d.cpp:428`) on a material built by
 * `BaseMaterial3D::get_material_for_2d`, which sets `FLAG_SRGB_VERTEX_COLOR`
 * alongside `FLAG_ALBEDO_FROM_VERTEX_COLOR` (`material.cpp:3048-3049`); that
 * flag emits a vertex-shader sRGB->linear decode of `COLOR.rgb` whenever the
 * render target is not itself sRGB (`material.cpp:1218`), i.e. always in 3D.
 * On this path the tint is baked into the raster as sRGB bytes and the
 * texture's own `SRGBColorSpace` tag is what decodes it, before
 * `MeshBasicMaterial`'s own tone-curve and encode chunks.
 *
 * Every `<TextRun>` here passes `frameExcluded` — this mesh must never
 * contribute to `frameSceneBounds.ts`'s auto-fit. `CameraFit`'s later
 * retries sometimes land AFTER this lazy chunk resolves, and the mounted
 * glyph mesh's own extent
 * then grows the auto-fit bounds — but Godot's own reference camera never
 * sees it (`Component.tsx`'s own doc has the full measurement: `_place_camera`
 * runs before ANY Label3D has shaped text, every time, so it is placed from
 * bounds where every Label3D contributes only its origin). Whether this
 * chunk happens to resolve inside the retry window is incidental load
 * timing, not something a golden should depend on either way — excluding it
 * outright is what keeps the auto-fit deterministic AND matching Godot,
 * instead of matching Godot only when the network/cache happens to be slow
 * enough.
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
import { layoutLabel3DLines, outlineStrokeWidthPx } from './glyphLayout';
import { AlphaCutMode, TextureFilter, type Label3DProperties } from './types';

/** Stand-in for the prepass cut, which Godot takes from the SCENE, not the node — same constant Sprite3D's own switch uses. */
const PREPASS_ALPHA_TEST = 0.5;

/**
 * `label_3d.cpp:386-393`'s `mat_transparency` switch in three's terms, the
 * other half of what `alpha_cut` selects (the z-shift/render-priority half is
 * `surface()` below). SCISSOR and HASH force `alpha = 1.0` past the cut
 * (`scene_forward_clustered.glsl:1414-1416`) and so land in the opaque list
 * (`scene_shader_forward_clustered.cpp:252`), which writes depth;
 * DEPTH_PRE_PASS keeps blending and cuts only in the depth pass, against the
 * scene's own `opaque_prepass_threshold` (`render_forward_clustered.cpp:1791`).
 * Label3D has no `FLAG_TRANSPARENT` to disable the switch (`label_3d.h:42-47`).
 */
function alphaCutTransparency(properties: Label3DProperties): CanvasTextTransparency {
  switch (properties.alpha_cut) {
    case AlphaCutMode.DISCARD:
      // `label_3d.cpp:378` hands the node's own threshold to the material.
      return {
        transparent: false,
        depthWrite: true,
        alphaTest: properties.alpha_scissor_threshold,
        alphaHash: false,
      };
    case AlphaCutMode.HASH:
      return { transparent: false, depthWrite: true, alphaTest: 0, alphaHash: true };
    case AlphaCutMode.OPAQUE_PREPASS:
      return { transparent: true, depthWrite: true, alphaTest: PREPASS_ALPHA_TEST, alphaHash: false };
    case AlphaCutMode.DISABLED:
    default:
      // `depth_draw_opaque` on a blended surface writes no depth (`material.cpp:800`).
      return { transparent: true, depthWrite: false, alphaTest: 0, alphaHash: false };
  }
}

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

  const layout = useMemo(
    () =>
      // Godot breaks the paragraph on `\n` only (`width` is unparsed, so
      // autowrap is always effectively OFF — `shapeText` forces an
      // unconstrained width for OFF regardless of `boxWidthPx`).
      shapeText(properties.text, {
        fontSizePx: properties.font_size,
        boxWidthPx: 0,
        autowrapMode: AutowrapMode.OFF,
        lineSpacingPx: properties.line_spacing,
        fontMetrics,
      }),
    [properties.text, properties.font_size, properties.line_spacing, fontMetrics]
  );

  const placements = useMemo(
    () =>
      layoutLabel3DLines(layout, properties.horizontal_alignment, properties.line_spacing),
    [layout, properties.horizontal_alignment, properties.line_spacing]
  );

  // Memoised, not built inline in the `.map` below: `TextRun` keys its
  // geometry AND material off this object's identity and disposes the old
  // pair on every change, so a fresh object per render re-meshes every line
  // on every render. Both surfaces of a line share ONE of these — that is
  // what registers their ink, since each pads its own raster differently.
  const lineLayouts = useMemo(
    () => placements.map((placement) => soloLineLayout(placement.line, layout)),
    [placements, layout]
  );

  const depthTest = !properties.no_depth_test;
  const side = properties.double_sided === false ? THREE.FrontSide : THREE.DoubleSide;

  const drawOutline = properties.outline_size > 0 && properties.outline_modulate.a !== 0;
  const strokeWidthPx = drawOutline ? outlineStrokeWidthPx(properties.outline_size) : 0;

  // `label_3d.cpp:401-405`: the two are exclusive. Only an ALPHA_CUT_DISABLED
  // surface keeps `TRANSPARENCY_ALPHA` and is sorted by its material's render
  // priority; any other mode bakes `priority * pixel_size` into the vertex Z
  // instead (`:417-420`) — geometry here is Godot px inside `Component.tsx`'s
  // own `pixel_size` group, so the shift is the bare priority.
  const sortedByPriority = properties.alpha_cut === AlphaCutMode.DISABLED;
  const surface = (priority: number) => ({
    renderOrder: sortedByPriority ? priority : 0,
    zShiftPx: sortedByPriority ? 0 : priority,
  });
  const outlineSurface = surface(properties.outline_render_priority);
  const fillSurface = surface(properties.render_priority);

  // Not memoised: `TextRun` keys its material off this object's FIELDS, not its
  // identity, so a fresh equal-valued one rebuilds nothing.
  const transparency = alphaCutTransparency(properties);

  // `material.h:172-177`: the enum alternates NEAREST, LINEAR, so the even
  // members are the nearest ones whatever their mipmap/anisotropy suffix.
  const textureFilter = properties.texture_filter % 2 === TextureFilter.NEAREST ? 'nearest' : 'linear';

  if (!fontMetrics) return null;

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
