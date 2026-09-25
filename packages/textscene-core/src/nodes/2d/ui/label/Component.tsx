/**
 * `<Label>`, the native (WebGL canvas) painter for Label, drawing through the
 * MSDF text engine (`native/text/textLayout.ts` and `TextRun.tsx`).
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
  labelUnwrappedShape,
  labelVisibleLineRange,
  layoutLabelLines,
  resolveNodeLabelSettings,
  windowLabelLines,
  type LabelLinePlacement,
} from './nativeSolver';
import type { LabelProperties } from './types';

/**
 * The per-line `TextLayoutResult`s, memoised with their placements. `TextRun`
 * rebuilds its geometry whenever its `layout` identity changes, so building these
 * inline would re-mesh each line on each render.
 */
function useSoloLineLayouts(placements: LabelLinePlacement[], layout: TextLayoutResult): TextLayoutResult[] {
  return useMemo(
    () => placements.map((placement) => soloLineLayout(placement.line, layout)),
    [placements, layout]
  );
}

export function Label({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<LabelProperties>(solveNode);
  const themeResolved = useMemo(() => labelTextTheme(solveNode, props, { theme }), [solveNode, props, theme]);
  const labelSettings = useMemo(
    () => resolveNodeLabelSettings(props, solveNode.resources.internalResources),
    [props, solveNode.resources.internalResources]
  );
  // A valid `label_settings` beats the theme outright: see its own doc.
  const textTheme = useMemo(() => labelEffectiveTextTheme(themeResolved, labelSettings), [themeResolved, labelSettings]);

  // Composed in sRGB: `TextRun` converts its `tint` once, internally.
  const tintColor = multiplyModulate(tint.own, textTheme.color);

  // label.cpp:762-767,876-878: the outline draws over the fill at the same pen
  // position, so `<TextRun>` composites both in one pass. The shadow draws behind,
  // at its own offset, colour and outline size.
  const outlineTheme = useMemo(() => labelOutlineTheme(solveNode, labelSettings), [solveNode, labelSettings]);
  const shadowTheme = useMemo(() => labelShadowTheme(solveNode, labelSettings), [solveNode, labelSettings]);
  const outlineColor = multiplyModulate(tint.own, outlineTheme.color);
  const shadowColor = multiplyModulate(tint.own, shadowTheme.color);
  const hasOutline = outlineTheme.size > 0 && outlineColor.a !== 0;
  const hasShadow = shadowColor.a > 0;
  const inheritedClippingPlanes = useControlClipPlanes();
  // `clip_text` scissors this Label's own drawn ink to its rect
  // (`label.cpp:733-734`'s `canvas_item_set_clip`): always called (hooks run
  // unconditionally) but only consumed below when `props.clipText` is set.
  const ownRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const { anchorRef, clippingPlanes: ownClippingPlanes } = useWorldClipPlanes(ownRect);
  const clippingPlanes = props.clipText ? ownClippingPlanes : inheritedClippingPlanes;

  // VC_CHARS_BEFORE_SHAPING (the default) truncates before shaping: see
  // `labelPreShapeText`'s own doc; every other behaviour trims at draw time,
  // below.
  const text = labelPreShapeText(props.text ?? '', props.visibleCharacters, props.visibleCharactersBehavior);
  // Label's own default is OFF (`label.h`'s `autowrap_mode` initialiser).
  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.OFF);
  // Autowrap off reuses `labelUnwrappedShape`, the solve handoff `labelMinimumSize`
  // shares. Autowrap on shapes against `rect.w`, which no share knows. The share
  // is already windowed to lines_skipped/max_lines_visible, so it is not windowed again.
  const sharedLayout = autowrapMode === AutowrapMode.OFF ? labelUnwrappedShape(solveNode, theme) : null;
  // Read in the render body, not the `useMemo`: `peekSceneFontMetrics` reads a
  // WeakMap cache that a later async load fills in place, so each render must look.
  // The `useMemo` dependency on `fontMetrics` limits re-shaping to an identity change.
  const fontMetrics = resolveNodeFontMetrics(solveNode, LABEL_THEME_FONT_KEY);
  const layout = useMemo(() => {
    if (sharedLayout) return sharedLayout;
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
    sharedLayout,
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

  // Godot aligns each line by its own width (`Label::_get_line_rect`), so each line
  // gets its own box top here, and `<TextRun>` anchors it at the baseline.
  const placements = useMemo(
    () =>
      layoutLabelLines(
        layout,
        rect.w,
        rect.h,
        props.horizontalAlignment,
        props.verticalAlignment,
        effectiveJustificationFlags,
        textTheme.fontSizePx,
        { rtl: solveNode.rtl }
      ),
    [
      layout,
      rect.w,
      rect.h,
      props.horizontalAlignment,
      props.verticalAlignment,
      effectiveJustificationFlags,
      textTheme.fontSizePx,
      solveNode.rtl,
    ]
  );

  // label.cpp:302-332 (autowrap OFF): each line is overrun-trimmed at the shaping
  // width, whatever clip_text says. The autowrap-ON branch (`:269-301`) trims only
  // the line `max_lines_visible` hides, which is not modelled
  // (`LabelProperties.overrunBehavior`).
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

  // label.cpp:778-883's draw-time reveal: Godot ORs it with the overrun trim in
  // one draw loop. `visibleCharacters`/`visibleRatio` are `parseLabel`'s final
  // numbers, and VC_CHARS_BEFORE_SHAPING, the default, already ran before shaping.
  const revealedPlacements = useMemo(() => {
    const revealed = applyVisibleCharsReveal(
      trimmedPlacements.map((placement) => placement.line),
      {
        behavior: props.visibleCharactersBehavior ?? VC_CHARS_BEFORE_SHAPING,
        visibleChars: props.visibleCharacters,
        visibleRatio: props.visibleRatio,
        rtl: solveNode.rtl,
      }
    );
    return trimmedPlacements.map((placement, index) => ({ ...placement, line: revealed[index]! }));
  }, [trimmedPlacements, props.visibleCharactersBehavior, props.visibleCharacters, props.visibleRatio, solveNode.rtl]);

  const lineLayouts = useSoloLineLayouts(revealedPlacements, layout);

  // Each `<TextRun>` takes `renderOrder` itself, since three never inherits it,
  // and sits in a `<CanvasItemGroup>`, since three reads the nearest group's order
  // first and a bare `<group>` resets it to zero (`r3f/canvasPaintOrder.ts`).
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
