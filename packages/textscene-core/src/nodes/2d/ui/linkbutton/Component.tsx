/**
 * `<LinkButton>` — the native (WebGL canvas) painter for `LinkButton`: text
 * only, NO StyleBox chrome mesh (LinkButton registers none — only a `focus`
 * StyleBox, which a static pointer-less preview never draws), plus a solid
 * underline stroke when `underline_mode` calls for it at this draw state.
 * Text draws at the control's own top edge with no margin at all — unlike
 * every StyleBox-backed Button-family painter — and hugs the leading edge
 * layout direction picks (`nativeSolver.ts`'s `linkButtonTextPlacement`), the
 * underline running the same span.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`. Multiplied into the font colour BEFORE the single
 * sRGB→linear conversion, and reused as-is for the underline stroke (the
 * SAME `color` Godot's own `draw_line` call passes — `link_button.cpp:311,313`).
 *
 * `renderOrder` reaches the text `<TextRun>` and the underline `ControlQuad`
 * alike; `clippingPlanes` reaches the text material explicitly.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
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

  // --- Text: theme resolution + shaping ------------------------------------
  const { fontSizePx, color: baseFontColor } = linkButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  const fontMetrics = resolveNodeFontMetrics(solveNode, LINKBUTTON_THEME_FONT_KEY);
  // The solve handoff share — the SAME shaping `linkButtonMinimumSize` sized
  // this control from. The trimming below is this painter's own, since it
  // reads the solved rect.
  const unshapedLayout: TextLayoutResult | null = linkButtonLabelShape(solveNode, theme);

  // link_button.cpp:286-289: `text_buf->set_width(MAX(1, size.width))` once
  // `overrun_behavior` is anything but NO_TRIMMING -- the control's own
  // resolved rect, no style margin (LinkButton draws no StyleBox at all).
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

  // `link_button.cpp:289-303` — the paragraph's own origin, which RTL moves
  // to the far edge; the underline below starts from the same x.
  const placement = useMemo(
    () => linkButtonTextPlacement(rect.w, layout?.widthPx ?? 0, solveNode.rtl),
    [rect.w, layout, solveNode.rtl]
  );

  // --- Underline: a solid stroke, per underline_mode + draw state ----------
  const underlineLinearColor = useGodotLinearColor(tintedFontColor);
  const underline = useMemo(() => {
    if (!layout || !shouldUnderline(state, props.underline)) return null;
    // The SAME font this Label's own ascent draws from — a
    // `theme_override_fonts/font` scene font shapes the text at its own
    // ascent, and the underline must sit relative to THAT, not Open Sans's.
    const ascentPx = getFontAscentPx(fontMetrics, fontSizePx);
    const spacingConstant = linkButtonUnderlineSpacing(solveNode.constants, { theme });
    // The stroke's position/thickness stay Open Sans's own `post`-table
    // values regardless of `fontMetrics` — no scene font this engine loads
    // carries baked underline metrics of its own.
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
