/**
 * `<OptionButton>` — the native (WebGL canvas) painter for
 * `OptionButton`: Button-style StyleBox chrome, the SELECTED item's text (not
 * every item — this is a static previewer, never the open popup), and the
 * chevron arrow icon at its right edge, drawn from the vendored theme icons
 * (`native/themeIcons.ts`'s `OPTION_BUTTON_ICONS`).
 *
 * Tint follows `Button`'s rule: `modulate` is already folded into the
 * ambient `Modulate2DContext` by the walker, so this calls `useCanvasItemTint`
 * with `modulate: WHITE_MODULATE` and only this node's own `self_modulate`.
 * The StyleBox hands `tint.own` straight to `<StyleBoxQuad>`'s `color` prop
 * (two base colours, composed internally); the arrow's own
 * modulate is ALWAYS opaque white in the default theme (`modulate_arrow`
 * defaults `false`, `default_theme.cpp:251` — `NOTIFICATION_DRAW` then never
 * enters the font-colour switch at all, leaving `clr = Color(1, 1, 1)`
 * unconditionally), so the arrow quad's colour/opacity are `tint.color`/
 * `tint.opacity` directly, same as `CheckBox`'s icon.
 *
 * `renderOrder` reaches all three meshes (chrome `StyleBoxQuad`, arrow
 * `ControlQuad`, text `<TextRun>`); `clippingPlanes` reaches the text material
 * explicitly (the two quads read `useControlClipPlanes()` internally).
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { OPTION_BUTTON_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { shapeButtonLabel } from '../../../../r3f/controls/native/buttonBase';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  layoutOptionButtonContent,
  optionButtonTextTheme,
  pickButtonStyleBox,
  resolveButtonDrawState,
  resolveOptionButtonSelectedText,
  tintColor,
  OPTION_BUTTON_ARROW_NATURAL_SIZE,
  OPTION_BUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import type { OptionButtonProperties } from './types';

export function OptionButton({ solveNode, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = solveNode.node.properties as OptionButtonProperties;
  const state = resolveButtonDrawState(props.disabled);

  const baseStyleBox = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.optionButton, state);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  const clippingPlanes = useControlClipPlanes();

  const arrowTexture = useIconTexture(OPTION_BUTTON_ICONS.arrow);

  // --- Text: the SELECTED item only, never the popup's full list -----------
  const text = resolveOptionButtonSelectedText(props);
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = optionButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  // Read INSIDE the render body, not the `useMemo` below — see Label's own
  // Component.tsx for why.
  const fontMetrics = resolveNodeFontMetrics(solveNode, OPTION_BUTTON_THEME_FONT_KEY);
  const layout: TextLayoutResult | null = useMemo(
    () =>
      hasText
        ? shapeButtonLabel(text, fontSizePx, fontMetrics)
        : null,
    [hasText, text, fontSizePx, fontMetrics]
  );

  // --- Content layout: text + arrow placement within the solved rect ------
  const arrowMargin = props.themeOverrideConstants?.arrow_margin ?? theme.separation;

  const content = useMemo(
    () =>
      layoutOptionButtonContent({
        rectSize: { x: rect.w, y: rect.h },
        styleMargin: baseStyleBox.contentMargin,
        arrowSize: OPTION_BUTTON_ARROW_NATURAL_SIZE,
        arrowMargin,
        // Godot's draw path reads the same ceiled `text_buf->get_size()` its
        // minimum size does (`scene/gui/button.cpp:343,349`), so the alignment
        // shift is computed against the ceiled width, not the raw pen advance.
        // Only the width needs it: `Size2::ceil()` ceils both components, but
        // the line pitch is already a sum of independently-ceiled ascent and
        // descent plus an integral theme spacing, so the height is integral.
        textNaturalSize: layout
          ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
          : { x: 0, y: 0 },
      }),
    [rect.w, rect.h, baseStyleBox.contentMargin, arrowMargin, layout]
  );

  return (
    <>
      <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      <group position={[content.arrowRect.x, -content.arrowRect.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={content.arrowRect.w}
          height={content.arrowRect.h}
          color={tint.color}
          opacity={tint.opacity}
          map={arrowTexture}
        />
      </group>
      {hasText && layout && (
        <group position={[content.textOffset.x, -content.textOffset.y, 0]}>
          <TextRun
            layout={layout}
            fontSizePx={fontSizePx}
            tint={tintedFontColor}
            clippingPlanes={clippingPlanes}
            renderOrder={renderOrder}
          />
        </group>
      )}
    </>
  );
}
