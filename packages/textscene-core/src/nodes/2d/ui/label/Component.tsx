/**
 * `<Label>` — the native (WebGL canvas) painter for Label: the first
 * text-bearing Control, drawing through the shared MSDF text engine
 * (`native/text/textLayout.ts` + `TextRun.tsx`) instead of the empty-outline
 * `<ControlFallback>` every other text widget still falls back to.
 *
 * Godot aligns EVERY LINE of a Label independently by its own width
 * (`Label::_get_line_rect`) — a single merged multi-line `<TextRun>` (sharing
 * one x origin) cannot express that once lines differ in width, so this
 * draws one `<TextRun>` per line, each in its own positioned `<CanvasItemGroup>`
 * (`nativeSolver.ts`'s `layoutLabelLines`, which returns each line's own box
 * top — `<TextRun>` anchors the line at its baseline from there itself,
 * `buildGlyphQuadArrays`'s own doc).
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. The resolved text COLOUR multiplies into `tint.own`
 * while both are still sRGB, matching `TextRun`'s own contract (its `tint`
 * prop is sRGB, converted internally) — one conversion, at the end.
 *
 * DRAW ORDER. Two halves, and getting only the first right is what once made
 * every Label's glyphs disappear behind the backdrop they were drawn over:
 * `renderOrder` is passed to each line's `<TextRun>` directly, because three
 * reads it per rendered object and never inherits it from a wrapping group —
 * but three reads the nearest enclosing GROUP's order FIRST, so each line's
 * group must carry the Control's canvas key too. `<CanvasItemGroup>` is what
 * supplies that; a bare `<group>` here resets it to zero
 * (`r3f/canvasPaintOrder.ts`).
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
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { useControlClipPlanes, useWorldClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import {
  AutowrapMode,
  clampAutowrapMode,
  shapeText,
  isTextLayoutResult,
  soloLineLayout,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { OverrunBehavior, overrunFlagsForBehavior, trimLineToWidth } from '../../../../r3f/controls/native/text/textOverrun';
import { JustificationFlag } from '../../../../r3f/controls/native/text/textJustify';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  LABEL_DEFAULT_JUSTIFICATION_FLAGS,
  LABEL_PARAGRAPH_SEPARATOR,
  LABEL_THEME_FONT_KEY,
  VC_CHARS_BEFORE_SHAPING,
  applyVisibleCharsReveal,
  labelEffectiveTextTheme,
  labelOutlineTheme,
  labelPreShapeText,
  labelShadowTheme,
  labelShapingWidthPx,
  labelTextTheme,
  labelVisibleLineRange,
  layoutLabelLines,
  resolveNodeLabelSettings,
  windowLabelLines,
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

export function Label({ solveNode, tint, rect, renderOrder, theme, meta }: NativeControlComponentProps) {
  const props = painterView<LabelProperties>(solveNode);
  const themeResolved = useMemo(() => labelTextTheme(solveNode, props, { theme }), [solveNode, props, theme]);
  const labelSettings = useMemo(
    () => resolveNodeLabelSettings(props, solveNode.resources.internalResources),
    [props, solveNode.resources.internalResources]
  );
  // A valid `label_settings` beats the theme OUTRIGHT — see its own doc.
  const textTheme = useMemo(() => labelEffectiveTextTheme(themeResolved, labelSettings), [themeResolved, labelSettings]);

  const tintColor = multiplyModulate(tint.own, textTheme.color);

  // label.cpp:762-767,876-878 — outline draws OVER the fill at the SAME pen
  // position (composited by `<TextRun>`'s own `outlineColor`/`outlineWidthPx`,
  // this file's own doc has why one pass suffices); shadow draws BEHIND, at
  // its own offset, in its own colour, with its own outline-expand.
  const outlineTheme = useMemo(() => labelOutlineTheme(solveNode, labelSettings), [solveNode, labelSettings]);
  const shadowTheme = useMemo(() => labelShadowTheme(solveNode, labelSettings), [solveNode, labelSettings]);
  const outlineColor = multiplyModulate(tint.own, outlineTheme.color);
  const shadowColor = multiplyModulate(tint.own, shadowTheme.color);
  const hasOutline = outlineTheme.size > 0 && outlineColor.a !== 0;
  const hasShadow = shadowColor.a > 0;
  const inheritedClippingPlanes = useControlClipPlanes();
  // `clip_text` scissors this Label's OWN drawn ink to its rect
  // (`label.cpp:733-734`'s `canvas_item_set_clip`) — always called (hooks run
  // unconditionally) but only CONSUMED below when `props.clipText` is set.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clippingPlanes: ownClippingPlanes } = useWorldClipPlanes(ownRect);
  const clippingPlanes = props.clipText ? ownClippingPlanes : inheritedClippingPlanes;

  // VC_CHARS_BEFORE_SHAPING (the default) truncates BEFORE shaping — see
  // `labelPreShapeText`'s own doc; every other behaviour trims at draw time,
  // below.
  const text = labelPreShapeText(props.text ?? '', props.visibleCharacters, props.visibleCharactersBehavior);
  // Label's own default is OFF (`label.h`'s `autowrap_mode` initialiser).
  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.OFF);
  // `labelMinimumSize` already windows its OWN `meta` to lines_skipped/
  // max_lines_visible (`nativeSolver.ts`'s own doc), so reusing it here must
  // NOT window a second time.
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
    const shaped = shapeText(text, {
      fontSizePx: textTheme.fontSizePx,
      boxWidthPx: labelShapingWidthPx(rect.w),
      autowrapMode,
      lineSpacingPx: textTheme.lineSpacingPx,
      uppercase: props.uppercase,
      fontMetrics,
      paragraphSeparator: props.paragraphSeparator ?? LABEL_PARAGRAPH_SEPARATOR,
      tabStopsPx: props.tabStopsPx,
      autowrapTrimFlags: props.autowrapTrimFlags,
    });
    const range = labelVisibleLineRange(shaped.lines.length, props.linesSkipped ?? 0, props.maxLinesVisible);
    return windowLabelLines(shaped, range);
  }, [
    cachedLayout,
    text,
    textTheme.fontSizePx,
    textTheme.lineSpacingPx,
    rect.w,
    autowrapMode,
    props.uppercase,
    fontMetrics,
    props.paragraphSeparator,
    props.tabStopsPx,
    props.autowrapTrimFlags,
    props.linesSkipped,
    props.maxLinesVisible,
  ]);

  // label.cpp:266-267 -- a non-empty tab_stops always adds AFTER_LAST_TAB,
  // on top of whatever the scene's own justification_flags already set.
  const effectiveJustificationFlags = useMemo(() => {
    const base = props.justificationFlags ?? LABEL_DEFAULT_JUSTIFICATION_FLAGS;
    return props.tabStopsPx && props.tabStopsPx.length > 0 ? base | JustificationFlag.AFTER_LAST_TAB : base;
  }, [props.justificationFlags, props.tabStopsPx]);

  const placements = useMemo(
    () =>
      layoutLabelLines(
        layout,
        rect.w,
        rect.h,
        props.horizontalAlignment,
        props.verticalAlignment,
        effectiveJustificationFlags,
        textTheme.fontSizePx
      ),
    [layout, rect.w, rect.h, props.horizontalAlignment, props.verticalAlignment, effectiveJustificationFlags, textTheme.fontSizePx]
  );

  // label.cpp:302-332 (autowrap OFF): every line is overrun-trimmed at the
  // SAME shaping width `layout` was wrapped at, regardless of clip_text —
  // that key only collapses the minimum size (`nativeSolver.ts`) and gates
  // the scissor above. The autowrap-ON branch (`:269-301`) only trims the
  // ONE line `max_lines_visible` hides, which this engine does not model
  // (see `LabelProperties.overrunBehavior`'s own doc), so it is skipped here.
  const overrunFlags = useMemo(
    () => overrunFlagsForBehavior(props.overrunBehavior ?? OverrunBehavior.NO_TRIMMING),
    [props.overrunBehavior]
  );
  const trimmedPlacements = useMemo(() => {
    if (autowrapMode !== AutowrapMode.OFF || !overrunFlags.trim) return placements;
    const widthPx = labelShapingWidthPx(rect.w);
    return placements.map((placement) => ({
      ...placement,
      line: trimLineToWidth(placement.line, widthPx, overrunFlags, {
        fontMetrics,
        fontSizePx: textTheme.fontSizePx,
        ellipsisChar: props.ellipsisChar,
      }),
    }));
  }, [placements, autowrapMode, overrunFlags, rect.w, fontMetrics, textTheme.fontSizePx, props.ellipsisChar]);

  // label.cpp:778-883's draw-time reveal, on top of the overrun trim above —
  // both are independent per-glyph skip conditions Godot ORs together in the
  // SAME draw loop. `props.visibleCharacters`/`visibleRatio` are already
  // `parseLabel`'s FINAL cross-derived numbers (`resolveVisibleChars`'s own
  // doc). VC_CHARS_BEFORE_SHAPING (the default) already ran above, pre-shape.
  const revealedPlacements = useMemo(() => {
    const revealed = applyVisibleCharsReveal(
      trimmedPlacements.map((placement) => placement.line),
      {
        behavior: props.visibleCharactersBehavior ?? VC_CHARS_BEFORE_SHAPING,
        visibleChars: props.visibleCharacters,
        visibleRatio: props.visibleRatio,
      }
    );
    return trimmedPlacements.map((placement, index) => ({ ...placement, line: revealed[index]! }));
  }, [trimmedPlacements, props.visibleCharactersBehavior, props.visibleCharacters, props.visibleRatio]);

  const lineLayouts = useSoloLineLayouts(revealedPlacements, layout);

  return (
    <CanvasItemGroup ref={anchorRef}>
      {hasShadow &&
        revealedPlacements.map((placement, index) => (
          <CanvasItemGroup
            key={`shadow-${index}`}
            position={[placement.x + shadowTheme.offset.x, -(placement.y + shadowTheme.offset.y), 0]}
          >
            <TextRun
              layout={lineLayouts[index]!}
              fontSizePx={textTheme.fontSizePx}
              tint={shadowColor}
              outlineColor={shadowColor}
              outlineWidthPx={shadowTheme.size}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ))}
      {revealedPlacements.map((placement, index) => (
        <CanvasItemGroup key={index} position={[placement.x, -placement.y, 0]}>
          <TextRun
            layout={lineLayouts[index]!}
            fontSizePx={textTheme.fontSizePx}
            tint={tintColor}
            outlineColor={hasOutline ? outlineColor : undefined}
            outlineWidthPx={hasOutline ? outlineTheme.size : 0}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      ))}
    </CanvasItemGroup>
  );
}
