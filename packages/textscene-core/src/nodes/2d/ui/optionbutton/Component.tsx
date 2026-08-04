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
 * The StyleBox uses `tintStyleBox` (two base colours); the arrow's own
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
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapeText, AutowrapMode, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import {
  layoutOptionButtonContent,
  optionButtonTextTheme,
  pickButtonStyleBox,
  resolveButtonDrawState,
  resolveOptionButtonSelectedText,
  tintColor,
  tintStyleBox,
  OPTION_BUTTON_ARROW_NATURAL_SIZE,
} from './nativeSolver';
import type { OptionButtonProperties } from './types';

export function OptionButton({ solveNode, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = solveNode.node.properties as OptionButtonProperties;
  const state = resolveButtonDrawState(props.disabled);

  const baseStyleBox = pickButtonStyleBox(solveNode.styleBoxes, theme.widgets.optionButton, state);

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  const styleBox = useMemo(() => tintStyleBox(baseStyleBox, tint.own), [baseStyleBox, tint.own]);
  const clippingPlanes = useControlClipPlanes();

  const arrowTexture = useIconTexture(OPTION_BUTTON_ICONS.arrow);

  // --- Text: the SELECTED item only, never the popup's full list -----------
  const text = resolveOptionButtonSelectedText(props);
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = optionButtonTextTheme(props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  const layout: TextLayoutResult | null = useMemo(
    () => (hasText ? shapeText(text, { fontSizePx, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF }) : null),
    [hasText, text, fontSizePx]
  );

  // --- Content layout: text + arrow placement within the solved rect ------
  const arrowMargin = props.themeOverrideConstants?.arrow_margin ?? theme.separation;

  const content = useMemo(
    () =>
      layoutOptionButtonContent({
        rectSize: { x: rect.w, y: rect.h },
        styleMargin: styleBox.contentMargin,
        arrowSize: OPTION_BUTTON_ARROW_NATURAL_SIZE,
        arrowMargin,
        textNaturalSize: layout ? { x: layout.widthPx, y: layout.heightPx } : { x: 0, y: 0 },
        fontSizePx,
      }),
    [rect.w, rect.h, styleBox.contentMargin, arrowMargin, layout, fontSizePx]
  );

  return (
    <>
      <StyleBoxQuad styleBox={styleBox} rect={rect} renderOrder={renderOrder} />
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
