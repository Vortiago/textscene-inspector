/**
 * `<OptionButton>`, the native painter: Button-style StyleBox chrome, the selected item's text and the
 * chevron arrow from `OPTION_BUTTON_ICONS`. The arrow's theme colour stays white, since `modulate_arrow`
 * defaults false (`default_theme.cpp:251`), so its quad takes `tint` directly, as CheckBox's icon does.
 * `ControlCanvasWalker` owns `visible`, `children` and the transform.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { OPTION_BUTTON_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { ButtonLabel, useButtonLabelLayout } from '../../../../r3f/controls/native/ButtonLabel';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import {
  layoutOptionButtonContent,
  optionButtonHSeparation,
  optionButtonTextTheme,
  pickButtonStyleBox,
  resolveButtonDrawState,
  optionButtonArrowSize,
  resolveOptionButtonSelectedText,
  tintColor,
  OPTION_BUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import type { OptionButtonProperties } from './types';

export function OptionButton({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<OptionButtonProperties>(solveNode);
  const state = resolveButtonDrawState(props.disabled);

  const baseStyleBox = pickButtonStyleBox(
    solveNode.styleBoxes,
    theme.widgets.optionButton,
    state,
    solveNode.rtl
  );

  const clippingPlanes = useControlClipPlanes();

  const arrowTexture = useNodeIcon(solveNode.icons.arrow, OPTION_BUTTON_ICONS.arrow);
  const arrowSize = useMemo(() => optionButtonArrowSize(solveNode), [solveNode]);

  // Text: the selected item only, never the popup's full list
  const text = resolveOptionButtonSelectedText(props);
  const hasText = text.length > 0;
  const { fontSizePx, color: baseFontColor } = optionButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);

  const layout = useButtonLabelLayout(solveNode, OPTION_BUTTON_THEME_FONT_KEY, text, fontSizePx);

  // Content layout: text and arrow placement within the solved rect
  const arrowMargin = solveNode.constants.arrow_margin ?? theme.separation;

  const content = useMemo(
    () =>
      layoutOptionButtonContent({
        rectSize: { x: rect.w, y: rect.h },
        styleMargin: baseStyleBox.contentMargin,
        arrowSize,
        arrowMargin,
        hSeparation: optionButtonHSeparation(solveNode.constants, { theme }),
        rtl: solveNode.rtl,
        // Integral: ceiled ascent plus ceiled descent plus an integral spacing.
        textHeightPx: layout?.heightPx ?? 0,
        textAlignment: props.alignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
      }),
    [
      rect.w,
      rect.h,
      baseStyleBox.contentMargin,
      arrowSize,
      arrowMargin,
      layout,
      props.alignment,
      solveNode.constants,
      theme,
      solveNode.rtl,
    ]
  );

  return (
    <>
      {/* `Button::_notification`'s `if (!flat)` (`button.cpp:216`), inherited,
          and the only thing `flat` changes: the minimum size still carries the
          stylebox's margins (`:525`). */}
      {!props.flat && (
        <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      )}
      <CanvasItemGroup position={[content.arrowRect.x, -content.arrowRect.y, 0]}>
        <ControlQuad
          renderOrder={renderOrder}
          width={content.arrowRect.w}
          height={content.arrowRect.h}
          color={tint.color}
          opacity={tint.opacity}
          map={arrowTexture}
        />
      </CanvasItemGroup>
      {hasText && layout && (
        <ButtonLabel
          layout={layout}
          box={content.labelBox}
          fontSizePx={fontSizePx}
          tint={tintedFontColor}
          clippingPlanes={clippingPlanes}
          renderOrder={renderOrder}
        />
      )}
    </>
  );
}
