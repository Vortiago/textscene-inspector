/**
 * Label3D's glyph-drawing pass — the part of the shared MSDF text engine
 * (`r3f/controls/native/text/`) that pulls in the vendored Open Sans atlas
 * (`shapeText`, `TextRun`). `Component.tsx` loads this module via
 * `React.lazy` so the atlas stays out of the initial render bundle — the
 * SAME split `nodes/viewport/subviewport/ControlRasterLayer.tsx` documents
 * for the same reason (an `import()` boundary, not a second
 * shaping/layout implementation: `shapeText` and `TextRun` are reused
 * verbatim, exactly as the 2D Control Label uses them).
 *
 * One `<TextRun>` per line (`layoutLabel3DLines`), each in its own
 * positioned `<group>` — Godot aligns EVERY LINE of a Label3D independently
 * by its own width (`label_3d.cpp:588-599`), so a single merged multi-line
 * run sharing one x origin cannot express that once lines differ in width,
 * the same reason `nodes/2d/ui/label/Component.tsx` draws one run per line.
 *
 * The outline (`label_3d.cpp:610`: drawn when `outline_modulate.a != 0.0 &&
 * outline_size > 0`) is the SAME `<TextRun>`'s `outlineTint`/`outlineBias`
 * props — a second, more-dilated threshold decoded in the SAME draw call as
 * the fill, not a second overlapping mesh. `msdfMaterial.ts`'s own doc has
 * the measured reason: two independently alpha-blended meshes of a
 * near-identical shape darken every anti-aliased edge, which at a small
 * on-screen caption (most of its fragments ARE edge fragments) rendered a
 * solid blob instead of a thin outline.
 *
 * Every `<TextRun>` here passes `frameExcluded` — this mesh must never
 * contribute to `frameSceneBounds.ts`'s auto-fit. Measured on
 * `unit-material-heightmap.tscn`: `CameraFit`'s later retries sometimes land
 * AFTER this lazy chunk resolves, and the mounted glyph mesh's own extent
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
import { useMemo } from 'react';
import * as THREE from 'three';
import {
  AutowrapMode,
  shapeText,
  type TextLayoutResult,
  type TextLineLayout,
} from '../../../r3f/controls/native/text/textLayout';
import { TextRun } from '../../../r3f/controls/native/text/TextRun';
import { layoutLabel3DLines, outlineDistanceBias } from './glyphLayout';
import type { Label3DProperties } from './types';

/**
 * Wraps one line as its own one-line `TextLayoutResult` — `TextRun` computes
 * `lineIndex * linePitchPx` internally, which is 0 for a solo line, so it
 * draws relative to y=0; the caller (this component) supplies the real
 * cumulative Y via the wrapping `<group>`'s own position. Mirrors
 * `nodes/2d/ui/label/Component.tsx`'s `soloLineLayout`.
 */
function soloLineLayout(line: TextLineLayout, linePitchPx: number): TextLayoutResult {
  return { lines: [line], linePitchPx, widthPx: line.widthPx, heightPx: linePitchPx };
}

export interface LabelGlyphsProps {
  properties: Label3DProperties;
}

export default function LabelGlyphs({ properties }: LabelGlyphsProps) {
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
      }),
    [properties.text, properties.font_size, properties.line_spacing]
  );

  const placements = useMemo(
    () =>
      layoutLabel3DLines(
        layout,
        properties.horizontal_alignment,
        properties.line_spacing,
        properties.font_size
      ),
    [layout, properties.horizontal_alignment, properties.line_spacing, properties.font_size]
  );

  const depthTest = !properties.no_depth_test;
  const side = properties.double_sided === false ? THREE.FrontSide : THREE.DoubleSide;

  const drawOutline = properties.outline_size > 0 && properties.outline_modulate.a !== 0;
  const outlineBias = drawOutline
    ? outlineDistanceBias(properties.outline_size, properties.font_size)
    : 0;

  return (
    <>
      {placements.map((placement, index) => {
        const oneLine = soloLineLayout(placement.line, layout.linePitchPx);
        return (
          <group key={index} position={[placement.x, -placement.y, 0]}>
            <TextRun
              layout={oneLine}
              fontSizePx={properties.font_size}
              tint={properties.modulate}
              depthTest={depthTest}
              side={side}
              outlineTint={drawOutline ? properties.outline_modulate : undefined}
              outlineBias={outlineBias}
              frameExcluded
            />
          </group>
        );
      })}
    </>
  );
}
