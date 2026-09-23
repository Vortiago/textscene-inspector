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
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { tintColor } from '../../../../r3f/controls/native/buttonBase';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { getFontAscentPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { OverrunBehavior, overrunFlagsForBehavior, trimLineToWidth } from '../../../../r3f/controls/native/text/textOverrun';
import { soloLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import {
  linkButtonLabelShape,
  linkButtonTextPlacement,
  linkButtonTextTheme,
  linkButtonUnderlineGeometry,
  linkButtonUnderlineSpacing,
  resolveLinkButtonDrawState,
  shouldUnderline,
  LINKBUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import type { LinkButtonProperties } from './types';

export function LinkButton({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<LinkButtonProperties>(solveNode);
  const state = resolveLinkButtonDrawState(props);

  const clippingPlanes = useControlClipPlanes();

  // Text: theme resolution and shaping
  // `tint.own` (`self_modulate` on the inherited `modulate`) multiplies the font colour before its one
  // sRGB-to-linear conversion. The underline reuses that colour, as Godot's `draw_line` does
  // (`link_button.cpp:311,313`). `renderOrder` reaches the text and the underline alike.
  const { fontSizePx, color: baseFontColor } = linkButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  const fontMetrics = resolveNodeFontMetrics(solveNode, LINKBUTTON_THEME_FONT_KEY);
  // The solve-handoff share: the shaping `linkButtonMinimumSize` sized this control from. The trimming
  // below is this painter's own, since it reads the solved rect.
  const unshapedLayout: TextLayoutResult | null = linkButtonLabelShape(solveNode, theme);

  // link_button.cpp:286-289: `text_buf->set_width(MAX(1, size.width))` for any `overrun_behavior` but
  // NO_TRIMMING, at the control's own rect, with no style margin.
  const overrunFlags = useMemo(
    () => overrunFlagsForBehavior(props.overrunBehavior ?? OverrunBehavior.NO_TRIMMING),
    [props.overrunBehavior]
  );
  const layout: TextLayoutResult | null = useMemo(() => {
    if (!unshapedLayout || !overrunFlags.trim) return unshapedLayout;
    const trimmedLine = trimLineToWidth(unshapedLayout.lines[0]!, Math.max(1, rect.w), overrunFlags, {
      fontMetrics,
      fontSizePx,
      ellipsisChar: props.ellipsisChar,
    });
    return soloLineLayout(trimmedLine, unshapedLayout);
  }, [unshapedLayout, overrunFlags, rect.w, fontMetrics, fontSizePx, props.ellipsisChar]);

  // `link_button.cpp:289-303`: the paragraph origin, which RTL moves to the far edge. The underline
  // starts from the same x.
  const placement = useMemo(
    () => linkButtonTextPlacement(rect.w, layout?.widthPx ?? 0, solveNode.rtl),
    [rect.w, layout, solveNode.rtl]
  );

  // Underline: a solid stroke, per underline_mode and draw state
  const underlineLinearColor = useGodotLinearColor(tintedFontColor);
  const underline = useMemo(() => {
    if (!layout || !shouldUnderline(state, props.underline)) return null;
    // The ascent of the font the text draws in: a `theme_override_fonts/font` scene font shapes at its
    // own ascent, and the underline sits relative to it, not to Open Sans's.
    const ascentPx = getFontAscentPx(fontMetrics, fontSizePx);
    const spacingConstant = linkButtonUnderlineSpacing(solveNode.constants, { theme });
    // The stroke's position and thickness stay Open Sans's `post`-table values whatever `fontMetrics`
    // is: no scene font this engine loads carries underline metrics.
    const { y, thickness } = linkButtonUnderlineGeometry(fontSizePx, spacingConstant, ascentPx);
    return { top: y - thickness / 2, thickness, width: placement.lineWidthPx };
  }, [layout, state, props, theme, fontSizePx, fontMetrics, solveNode.constants, placement]);

  return (
    <>
      {layout && (
        <CanvasItemGroup position={[placement.originX, 0, 0]}>
          <TextRun
            layout={layout}
            fontSizePx={fontSizePx}
            tint={tintedFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      )}
      {underline && underline.width > 0 && (
        <CanvasItemGroup position={[placement.originX, -underline.top, 0]}>
          <ControlQuad
            renderOrder={renderOrder}
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
