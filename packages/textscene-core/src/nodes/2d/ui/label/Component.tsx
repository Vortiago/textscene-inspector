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
  clampAutowrapMode,
  shapeText,
  soloLineLayout,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import {
  overrunFlagsForBehavior,
  trimFilledLineToWidth,
  trimLineToWidth,
} from '../../../../r3f/controls/native/text/textOverrun';
import { OutlineRingRun, textLayerRenderOrder } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import { TextRun, type TextRunProps } from '../../../../r3f/controls/native/text/TextRun';
import {
  LABEL_PARAGRAPH_SEPARATOR,
  applyVisibleCharsReveal,
  labelEffectiveTextTheme,
  labelFontState,
  labelPreShapeText,
  labelShapingWidthPx,
  labelTextTheme,
  labelUnwrappedShape,
  labelVisibleLineRange,
  layoutLabelLines,
  windowLabelLines,
  type LabelLinePlacement,
  type LineTrim,
} from './nativeSolver';
import { labelEffectLayers, labelFillLayer, type LabelEffectLayer } from './effectLayers';
import type { LabelProperties } from './types';
import {
  AutowrapMode,
  OverrunBehavior,
  VisibleCharactersBehavior,
  JustificationFlag,
  DEFAULT_JUSTIFICATION_FLAGS,
} from '../../../../godot/text/textServerEnums';

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

type LayerRunsProps = Pick<TextRunProps, 'fontSizePx' | 'clippingPlanes' | 'renderOrder'> & {
  layer: LabelEffectLayer;
  placements: LabelLinePlacement[];
  lineLayouts: TextLayoutResult[];
};

/** One layer on every line. A ring strokes on the canvas painter, a plain layer draws on the painter of its font. */
function LayerRuns({ layer, placements, lineLayouts, ...run }: LayerRunsProps) {
  return placements.map((placement, index) => (
    <CanvasItemGroup
      key={index}
      position={[placement.x + layer.offset.x, -(placement.y + layer.offset.y), 0]}
    >
      {layer.kind === 'ring' ? (
        <OutlineRingRun {...run} layout={lineLayouts[index]!} tint={layer.color} sizePx={layer.ringSizePx} />
      ) : (
        <TextRun {...run} layout={lineLayouts[index]!} tint={layer.color} />
      )}
    </CanvasItemGroup>
  ));
}

export function Label({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<LabelProperties>(solveNode);
  const themeResolved = useMemo(() => labelTextTheme(solveNode, props, { theme }), [solveNode, props, theme]);
  const labelSettings = solveNode.labelSettings;
  // A valid `label_settings` beats the theme outright: see its own doc.
  const textTheme = useMemo(
    () => labelEffectiveTextTheme(themeResolved, labelSettings, solveNode.constants),
    [themeResolved, labelSettings, solveNode.constants]
  );

  // Composed in sRGB: `TextRun` converts its `tint` once, internally.
  const tintColor = multiplyModulate(tint.own, textTheme.color);

  // label.cpp:828-883: the shadows and rings draw behind the fill, each with its own colour, and
  // the Label's modulate tints every layer as it tints the fill.
  const effectLayers = useMemo(() => labelEffectLayers(solveNode), [solveNode]);
  const layers = useMemo(
    () => [
      ...effectLayers
        .map((layer) => ({ ...layer, color: multiplyModulate(tint.own, layer.color) }))
        // A layer the modulate makes invisible draws nothing, so it gets no mesh.
        .filter((layer) => layer.color.a > 0),
      labelFillLayer(tintColor),
    ],
    [effectLayers, tint.own, tintColor]
  );
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
  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.AUTOWRAP_OFF);
  // Autowrap off reuses `labelUnwrappedShape`, the solve handoff `labelMinimumSize`
  // shares. Autowrap on shapes against `rect.w`, which no share knows. The share
  // is already windowed to lines_skipped/max_lines_visible, so it is not windowed again.
  const sharedLayout =
    autowrapMode === AutowrapMode.AUTOWRAP_OFF ? labelUnwrappedShape(solveNode, theme) : null;
  // Read in the render body, not the `useMemo`: `peekSceneFontMetrics` reads a
  // WeakMap cache that a later async load fills in place, so each render must look.
  // The `useMemo` dependency on `fontMetrics` limits re-shaping to an identity change.
  const { metrics: fontMetrics, isLoading: isFontLoading } = labelFontState(solveNode);
  const bidiOptions = useControlBidiOptions(props, solveNode);
  const layout = useMemo(() => {
    if (sharedLayout) return sharedLayout;
    // A loading font draws nothing, so its layout shapes no text.
    const shaped = shapeText(isFontLoading ? '' : text, {
      fontSizePx: textTheme.fontSizePx,
      boxWidthPx: labelShapingWidthPx(rect.w),
      autowrapMode,
      lineSpacingPx: textTheme.lineSpacingPx,
      uppercase: props.uppercase,
      fontMetrics,
      paragraphSeparator: props.paragraphSeparator ?? LABEL_PARAGRAPH_SEPARATOR,
      tabStopsPx: props.tabStopsPx,
      autowrapTrimFlags: props.autowrapTrimFlags,
      ...bidiOptions,
    });
    const range = labelVisibleLineRange(shaped.lines.length, props.linesSkipped ?? 0, props.maxLinesVisible);
    return windowLabelLines(shaped, range, textTheme.paragraphSpacingPx);
  }, [
    sharedLayout,
    isFontLoading,
    text,
    textTheme.fontSizePx,
    textTheme.lineSpacingPx,
    textTheme.paragraphSpacingPx,
    rect.w,
    autowrapMode,
    props.uppercase,
    fontMetrics,
    props.paragraphSeparator,
    props.tabStopsPx,
    props.autowrapTrimFlags,
    bidiOptions,
    props.linesSkipped,
    props.maxLinesVisible,
  ]);

  // label.cpp:266-267 -- a non-empty tab_stops always adds AFTER_LAST_TAB,
  // on top of whatever the scene's own justification_flags already set.
  const effectiveJustificationFlags = useMemo(() => {
    const base = props.justificationFlags ?? DEFAULT_JUSTIFICATION_FLAGS;
    return props.tabStopsPx && props.tabStopsPx.length > 0 ? base | JustificationFlag.AFTER_LAST_TAB : base;
  }, [props.justificationFlags, props.tabStopsPx]);

  // label.cpp:302-332 (autowrap OFF): each line is overrun-trimmed at the shaping
  // width, whatever clip_text says, before it is aligned. The autowrap-ON branch (`:269-301`)
  // trims only the line `max_lines_visible` hides, which is not modelled
  // (`LabelProperties.overrunBehavior`).
  const overrunFlags = useMemo(
    () => overrunFlagsForBehavior(props.overrunBehavior ?? OverrunBehavior.OVERRUN_NO_TRIMMING),
    [props.overrunBehavior]
  );
  const trim = useMemo((): LineTrim | undefined => {
    if (autowrapMode !== AutowrapMode.AUTOWRAP_OFF || !overrunFlags.trim) return undefined;
    const widthPx = labelShapingWidthPx(rect.w);
    const options = { fontMetrics, fontSizePx: textTheme.fontSizePx, ellipsisChar: props.ellipsisChar };
    return {
      line: (line) => trimLineToWidth(line, widthPx, overrunFlags, options),
      filledLine: (line, justificationFlags) =>
        trimFilledLineToWidth(line, widthPx, overrunFlags, { ...options, justificationFlags }),
    };
  }, [autowrapMode, overrunFlags, rect.w, fontMetrics, textTheme.fontSizePx, props.ellipsisChar]);

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
        {
          rtl: solveNode.rtl,
          isAutowrapped: autowrapMode !== AutowrapMode.AUTOWRAP_OFF,
          trim,
          lineSpacingPx: textTheme.lineSpacingPx,
          paragraphSpacingPx: textTheme.paragraphSpacingPx,
        }
      ),
    [
      layout,
      rect.w,
      rect.h,
      props.horizontalAlignment,
      props.verticalAlignment,
      effectiveJustificationFlags,
      textTheme.fontSizePx,
      textTheme.lineSpacingPx,
      textTheme.paragraphSpacingPx,
      solveNode.rtl,
      autowrapMode,
      trim,
    ]
  );

  // label.cpp:778-883's draw-time reveal: Godot ORs it with the overrun trim in
  // one draw loop. `visibleCharacters`/`visibleRatio` are `parseLabel`'s final
  // numbers, and VC_CHARS_BEFORE_SHAPING, the default, already ran before shaping.
  const revealedPlacements = useMemo(() => {
    const revealed = applyVisibleCharsReveal(
      placements.map((placement) => placement.line),
      {
        behavior: props.visibleCharactersBehavior ?? VisibleCharactersBehavior.VC_CHARS_BEFORE_SHAPING,
        text: layout.shapedText,
        visibleChars: props.visibleCharacters,
        visibleRatio: props.visibleRatio,
        rtl: solveNode.rtl,
      }
    );
    return placements.map((placement, index) => ({ ...placement, line: revealed[index]! }));
  }, [
    placements,
    props.visibleCharactersBehavior,
    layout.shapedText,
    props.visibleCharacters,
    props.visibleRatio,
    solveNode.rtl,
  ]);

  const lineLayouts = useSoloLineLayouts(revealedPlacements, layout);

  // A settings font that is still loading draws nothing, never the theme font (ADR-0059).
  if (isFontLoading) return <CanvasItemGroup ref={anchorRef} />;

  // Each run takes `renderOrder` itself, since three never inherits it, and sits in a
  // `<CanvasItemGroup>`, since three reads the nearest group's order first and a bare `<group>`
  // resets it to zero (`r3f/canvasPaintOrder.ts`).
  return (
    <CanvasItemGroup ref={anchorRef}>
      {layers.map((layer, layerIndex) => (
        <LayerRuns
          key={layerIndex}
          layer={layer}
          placements={revealedPlacements}
          lineLayouts={lineLayouts}
          fontSizePx={textTheme.fontSizePx}
          clippingPlanes={clippingPlanes}
          renderOrder={textLayerRenderOrder(renderOrder, layerIndex, layers.length)}
        />
      ))}
    </CanvasItemGroup>
  );
}
