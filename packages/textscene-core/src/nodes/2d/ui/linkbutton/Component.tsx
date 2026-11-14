/**
 * `<LinkButton>`, the native painter: text with no StyleBox chrome, since LinkButton registers only a
 * `focus` box that a static preview never draws, plus an underline stroke when `underline_mode` calls
 * for it. The text sits at the control's top edge with no margin and hugs the leading edge
 * (`linkButtonTextPlacement`). `ControlCanvasWalker` owns `visible`, `children` and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import {
  OutlinedTextRun,
  textLayerRenderOrder,
  useTintedTextOutline,
} from '../../../../r3f/controls/native/text/OutlinedTextRun';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { NO_UNDERLINE_PX } from '../../../../r3f/controls/native/text/paragraphUnderline';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { overrunFlagsForBehavior, trimSoloLine } from '../../../../r3f/controls/native/text/textOverrun';
import {
  linkButtonLabelShape,
  linkButtonTextPlacement,
  linkButtonTextTheme,
  linkButtonUnderlineGeometry,
  resolveLinkButtonDrawState,
  shouldUnderline,
  LINKBUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import type { LinkButtonProperties } from './types';
import { useItemLinearColor } from '../../../../r3f/canvasItemModulate';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';

/** The layers of an outlined run: its outline, then its fill. */
const OUTLINED_RUN_LAYERS = 2;

/** `link_button.cpp:292-313` draws the underline after the outline and the fill of its text. */
function underlineRenderOrder(renderOrder: number): number {
  return textLayerRenderOrder(renderOrder, OUTLINED_RUN_LAYERS, OUTLINED_RUN_LAYERS + 1);
}

export function LinkButton({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<LinkButtonProperties>(solveNode);
  const state = resolveLinkButtonDrawState(props);

  const clippingPlanes = useControlClipPlanes();

  // `tint.own` (`self_modulate` on the inherited `modulate`) multiplies the font colour before its one
  // sRGB-to-linear conversion. The underline reuses that colour, as Godot's `draw_line` does
  // (`link_button.cpp:311,313`). The underline orders after the text (`underlineRenderOrder`).
  const { fontSizePx, color: baseFontColor } = linkButtonTextTheme(solveNode, props, state);
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  const fontMetrics = resolveNodeFontMetrics(solveNode, LINKBUTTON_THEME_FONT_KEY);
  // The solve-handoff share: the shaping `linkButtonMinimumSize` sized this control from. The trimming
  // below is this painter's own, since it reads the solved rect.
  const unshapedLayout: TextLayoutResult | null = linkButtonLabelShape(solveNode, theme);

  // link_button.cpp:286-289: `text_buf->set_width(MAX(1, size.width))` for any `overrun_behavior` but
  // NO_TRIMMING, at the control's own rect, with no style margin.
  const overrunFlags = useMemo(() => overrunFlagsForBehavior(props.overrunBehavior), [props.overrunBehavior]);
  const layout: TextLayoutResult | null = useMemo(() => {
    if (!unshapedLayout) return null;
    return trimSoloLine(unshapedLayout, overrunFlags, Math.max(1, rect.w), {
      fontMetrics,
      fontSizePx,
      ellipsisChar: props.ellipsisChar,
    });
  }, [unshapedLayout, overrunFlags, rect.w, fontMetrics, fontSizePx, props.ellipsisChar]);

  // `link_button.cpp:289-303`: the paragraph origin, which RTL moves to the far edge. The underline
  // starts from the same x.
  const placement = useMemo(
    () => linkButtonTextPlacement(rect.w, layout?.widthPx ?? 0, solveNode.rtl),
    [rect.w, layout, solveNode.rtl]
  );

  // Underline: a solid stroke, per underline_mode and draw state
  const underlineLinearColor = useItemLinearColor(tintedFontColor);
  const underline = useMemo(() => {
    if (!layout || !shouldUnderline(state, props.underline)) return null;
    const spacingConstant = requiredThemeItem(solveNode.constants, 'underline_spacing');
    const lineUnderline = layout.lines[0]?.underline ?? NO_UNDERLINE_PX;
    const { y, thickness } = linkButtonUnderlineGeometry(
      lineUnderline,
      spacingConstant,
      layout.baselineOffsetPx
    );
    return { top: y - thickness / 2, thickness, width: placement.lineWidthPx };
  }, [layout, state, props, solveNode.constants, placement]);

  return (
    <>
      {layout && (
        <CanvasItemGroup position={[placement.originX, 0, 0]}>
          <OutlinedTextRun
            layout={layout}
            fontSizePx={fontSizePx}
            tint={tintedFontColor}
            outline={textOutline}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {underline && underline.width > 0 && (
        <CanvasItemGroup position={[placement.originX, -underline.top, 0]}>
          <ControlQuad
            renderOrder={underlineRenderOrder(renderOrder)}
            width={underline.width}
            height={underline.thickness}
            color={underlineLinearColor}
            opacity={tintedFontColor.a}
          />
        </CanvasItemGroup>
      )}
    </>
  );
}
