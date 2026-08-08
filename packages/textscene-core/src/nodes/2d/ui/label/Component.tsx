/**
 * `<Label>` — the native (WebGL canvas) painter for Label: the first
 * text-bearing Control, drawing through the shared MSDF text engine
 * (`native/text/textLayout.ts` + `TextRun.tsx`) instead of the empty-outline
 * `<ControlFallback>` every other text widget still falls back to.
 *
 * Godot aligns EVERY LINE of a Label independently by its own width
 * (`Label::_get_line_rect`) — a single merged multi-line `<TextRun>` (sharing
 * one x origin) cannot express that once lines differ in width, so this
 * draws one `<TextRun>` per line, each in its own positioned `<group>`
 * (`nativeSolver.ts`'s `layoutLabelLines`, which returns each line's own box
 * top — `<TextRun>` anchors the line at its baseline from there itself,
 * `buildGlyphQuadArrays`'s own doc).
 *
 * Tint: `ControlCanvasWalker` already folds this node's OWN `modulate` into
 * the `Modulate2DContext` value it provides AROUND this painter, so
 * `useCanvasItemTint` is called with `modulate: WHITE_MODULATE` (already
 * folded in), `self_modulate` from this node's own properties, and the
 * resolved text COLOUR as `ownMultiplier` — composed in sRGB, converted to
 * linear once, matching `TextRun`'s own contract (its `tint` prop is sRGB,
 * converted internally).
 *
 * `renderOrder` is passed to each line's `<TextRun>` directly: three.js reads
 * `renderOrder` per rendered object and never inherits it from a wrapping
 * `<group>`, so the per-line mesh has to carry it itself.
 *
 * TEXT LAYOUT: reads `meta` (`nativeSolver.ts`'s `labelMinimumSize` — see its
 * own doc) when autowrap is OFF (Label's default), instead of re-shaping —
 * that function already shapes the SAME text at the SAME effective
 * parameters (`shapeText` forces `effectiveWidth = 0` whenever
 * `autowrapMode === OFF` regardless of `boxWidthPx`, so `rect.w` never
 * mattered for this case anyway). Autowrap ON always re-shapes locally: the
 * solver's own minimum size substitutes an UNWRAPPED height for that case
 * (see `labelMinimumSize`'s own doc), so its shape is not the box-constrained
 * one this painter needs — reusing it there would be a silent wrong picture,
 * not a shortcut, so this component only ever reads `meta` for the ONE case
 * it is provably identical.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import {
  AutowrapMode,
  clampAutowrapMode,
  shapeText,
  isTextLayoutResult,
  soloLineLayout,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  LABEL_LINE_SPACING_PX,
  LABEL_THEME_FONT_KEY,
  labelShapingWidthPx,
  labelTextTheme,
  layoutLabelLines,
  type LabelLinePlacement,
} from './nativeSolver';
import type { LabelProperties } from './types';

/**
 * The per-line `TextLayoutResult`s, memoised together with the placements they
 * come from. `TextRun` keys its geometry off its `layout` prop's identity and
 * disposes the old one on every change, so building these inline would re-mesh
 * every line of every Label on every render — not just when the text or rect
 * actually changed.
 */
function useSoloLineLayouts(placements: LabelLinePlacement[], layout: TextLayoutResult): TextLayoutResult[] {
  return useMemo(
    () => placements.map((placement) => soloLineLayout(placement.line, layout)),
    [placements, layout]
  );
}

export function Label({ solveNode, rect, renderOrder, theme, meta }: NativeControlComponentProps) {
  const props = solveNode.node.properties as LabelProperties;
  const textTheme = useMemo(() => labelTextTheme(solveNode, props, { theme }), [solveNode, props, theme]);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint(
    { modulate: WHITE_MODULATE, self_modulate: selfModulate },
    textTheme.color
  );
  const tintColor = { r: tint.own.r, g: tint.own.g, b: tint.own.b, a: tint.own.a };
  const clippingPlanes = useControlClipPlanes();

  const text = props.text ?? '';
  // Label's own default is OFF (`label.h`'s `autowrap_mode` initialiser).
  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.OFF);
  const cachedLayout = autowrapMode === AutowrapMode.OFF && isTextLayoutResult(meta) ? meta : null;
  // Read INSIDE the render body, not the `useMemo` below: `peekSceneFontMetrics`
  // (`resolveNodeFontMetrics`'s own doc) answers synchronously from a WeakMap
  // cache that a later async load mutates in place, so this must re-run every
  // render to see a settled font — the `useMemo`'s own dependency array
  // (which includes `fontMetrics`) is what limits the actual re-SHAPE to when
  // this value's identity changes (the bundled default vs. a just-settled
  // scene font), not every render.
  const fontMetrics = resolveNodeFontMetrics(solveNode, LABEL_THEME_FONT_KEY);
  const layout = useMemo(() => {
    if (cachedLayout) return cachedLayout;
    return shapeText(text, {
      fontSizePx: textTheme.fontSizePx,
      boxWidthPx: labelShapingWidthPx(rect.w),
      autowrapMode,
      lineSpacingPx: LABEL_LINE_SPACING_PX,
      uppercase: props.uppercase,
      fontMetrics,
    });
  }, [cachedLayout, text, textTheme.fontSizePx, rect.w, autowrapMode, props.uppercase, fontMetrics]
  );

  const placements = useMemo(
    () =>
      layoutLabelLines(layout, rect.w, rect.h, props.horizontalAlignment, props.verticalAlignment),
    [layout, rect.w, rect.h, props.horizontalAlignment, props.verticalAlignment]
  );

  const lineLayouts = useSoloLineLayouts(placements, layout);

  return (
    <>
      {placements.map((placement, index) => (
        <group key={index} position={[placement.x, -placement.y, 0]}>
          <TextRun
            layout={lineLayouts[index]!}
            fontSizePx={textTheme.fontSizePx}
            tint={tintColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </group>
      ))}
    </>
  );
}
