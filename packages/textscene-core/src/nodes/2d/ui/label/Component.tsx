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
 * (`nativeSolver.ts`'s `layoutLabelLines`, which also folds in the
 * vertical-origin reconciliation against the atlas's own bake anchor —
 * see `originCorrectionPx`'s doc for the spike S2 residual it closes).
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
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { labelTextTheme, layoutLabelLines, type LabelLinePlacement } from './nativeSolver';
import type { LabelProperties } from './types';


/** A single line, wrapped as its own one-line `TextLayoutResult` — `TextRun` computes `lineIndex * linePitchPx` internally, which is 0 for a solo line, so it draws relative to y=0 with no cumulative pitch of its own; the caller (this component) supplies the real cumulative Y via the wrapping `<group>`'s position. */
function soloLineLayout(placement: LabelLinePlacement, linePitchPx: number): TextLayoutResult {
  return { lines: [placement.line], linePitchPx, widthPx: placement.line.widthPx, heightPx: linePitchPx };
}

/**
 * The per-line `TextLayoutResult`s, memoised together with the placements they
 * come from. `TextRun` keys its geometry off its `layout` prop's identity and
 * disposes the old one on every change, so building these inline would re-mesh
 * every line of every Label on every render — not just when the text or rect
 * actually changed.
 */
function useSoloLineLayouts(placements: LabelLinePlacement[], linePitchPx: number): TextLayoutResult[] {
  return useMemo(
    () => placements.map((placement) => soloLineLayout(placement, linePitchPx)),
    [placements, linePitchPx]
  );
}

export function Label({ solveNode, rect, renderOrder, theme, meta }: NativeControlComponentProps) {
  const props = solveNode.node.properties as LabelProperties;
  const textTheme = useMemo(() => labelTextTheme(props, { theme }), [props, theme]);

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
  const layout = useMemo(() => {
    if (cachedLayout) return cachedLayout;
    return shapeText(text, {
      fontSizePx: textTheme.fontSizePx,
      boxWidthPx: rect.w,
      autowrapMode,
      uppercase: props.uppercase,
    });
  }, [cachedLayout, text, textTheme.fontSizePx, rect.w, autowrapMode, props.uppercase]
  );

  const placements = useMemo(
    () =>
      layoutLabelLines(
        layout,
        rect.w,
        rect.h,
        props.horizontalAlignment,
        props.verticalAlignment,
        textTheme.fontSizePx
      ),
    [layout, rect.w, rect.h, props.horizontalAlignment, props.verticalAlignment, textTheme.fontSizePx]
  );

  const lineLayouts = useSoloLineLayouts(placements, layout.linePitchPx);

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
