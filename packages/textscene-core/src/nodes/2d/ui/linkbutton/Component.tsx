/**
 * `<LinkButton>` — the native (WebGL canvas) painter for `LinkButton`: text
 * only, NO StyleBox chrome mesh (LinkButton registers none — only a `focus`
 * StyleBox, which a static pointer-less preview never draws), plus a solid
 * underline stroke when `underline_mode` calls for it at this draw state.
 * Text draws at the control's own top-left with no margin at all — unlike
 * every StyleBox-backed Button-family painter, `link_button.cpp`'s own draw
 * call is `text_buf->draw(ci, Vector2(0, 0), color)`.
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
import { shapeButtonLabel, tintColor } from '../../../../r3f/controls/native/buttonBase';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  isTextLayoutResult,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { getFontAscentPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  linkButtonTextTheme,
  linkButtonUnderlineGeometry,
  linkButtonUnderlineSpacing,
  resolveLinkButtonDrawState,
  shouldUnderline,
  LINKBUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import type { LinkButtonProperties } from './types';

export function LinkButton({ solveNode, tint, renderOrder, theme, meta }: NativeControlComponentProps) {
  const props = painterView<LinkButtonProperties>(solveNode);
  const state = resolveLinkButtonDrawState(props);

  const clippingPlanes = useControlClipPlanes();

  // --- Text: theme resolution + shaping ------------------------------------
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = linkButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // See Label's own Component.tsx for why this reads INSIDE the render body
  // rather than inside the `useMemo` below.
  const fontMetrics = resolveNodeFontMetrics(solveNode, LINKBUTTON_THEME_FONT_KEY);
  const cachedLayout = isTextLayoutResult(meta) ? meta : null;
  const layout: TextLayoutResult | null = useMemo(() => {
    if (!hasText) return null;
    if (cachedLayout) return cachedLayout;
    return shapeButtonLabel(text, fontSizePx, fontMetrics);
  }, [hasText, cachedLayout, text, fontSizePx, fontMetrics]);

  // --- Underline: a solid stroke, per underline_mode + draw state ----------
  const underlineLinearColor = useGodotLinearColor(tintedFontColor);
  const underline = useMemo(() => {
    if (!layout || !shouldUnderline(state, props.underline)) return null;
    // The SAME font this Label's own ascent draws from — a
    // `theme_override_fonts/font` scene font shapes the text at its own
    // ascent, and the underline must sit relative to THAT, not Open Sans's.
    const ascentPx = getFontAscentPx(fontMetrics, fontSizePx);
    const spacingConstant = linkButtonUnderlineSpacing(props, { theme });
    // The stroke's position/thickness stay Open Sans's own `post`-table
    // values regardless of `fontMetrics` — no scene font this engine loads
    // carries baked underline metrics of its own.
    const { y, thickness } = linkButtonUnderlineGeometry(fontSizePx, spacingConstant, ascentPx);
    return { top: y - thickness / 2, thickness, width: Math.trunc(layout.widthPx) };
  }, [layout, state, props, theme, fontSizePx, fontMetrics]);

  return (
    <>
      {layout && (
        <TextRun
          layout={layout}
          fontSizePx={fontSizePx}
          tint={tintedFontColor}
          clippingPlanes={clippingPlanes}
          renderOrder={renderOrder}
        />
      )}
      {underline && underline.width > 0 && (
        <CanvasItemGroup position={[0, -underline.top, 0]}>
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
