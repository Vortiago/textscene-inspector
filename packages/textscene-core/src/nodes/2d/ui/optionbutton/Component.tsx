/**
 * `<OptionButton>`, the native painter: Button-style StyleBox chrome, the selected item's icon and text, then
 * the chevron arrow from `OPTION_BUTTON_ICONS`, as `Button::_notification` draws before the arrow does.
 * The arrow's theme colour stays white, since `modulate_arrow` defaults false (`default_theme.cpp:251`), so
 * its quad takes `tint` directly, as CheckBox's icon does. `ControlCanvasWalker` owns `visible`,
 * `children` and the transform.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { OPTION_BUTTON_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { ButtonLabel, useWrappingButtonLabelLayout } from '../../../../r3f/controls/native/ButtonLabel';
import { useTintedTextOutline } from '../../../../r3f/controls/native/text/OutlinedTextRun';
import {
  ownButtonIconSize,
  isButtonAutowrapped,
  labelNaturalSize,
} from '../../../../r3f/controls/native/buttonBase';
import { useIconModulate, useIconRefTexture } from '../../../../r3f/controls/native/useButtonIcon';
import { infersRtl } from '../../../../r3f/controls/native/text/textLayout';
import { useControlBidiOptions } from '../../../../r3f/controls/native/text/useControlBidiOptions';
import { buttonIconColor } from '../button/nativeSolver';
import {
  layoutOptionButtonContent,
  optionButtonContentFacts,
  optionButtonTextTheme,
  pickButtonStyleBox,
  resolveToggleDrawState,
  optionButtonArrowSize,
  selectedOptionItem,
  tintColor,
  OPTION_BUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import type { OptionButtonProperties } from './types';

export function OptionButton({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<OptionButtonProperties>(solveNode);
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);

  const baseStyleBox = pickButtonStyleBox(
    solveNode.styleBoxes,
    theme.widgets.optionButton,
    state,
    solveNode.rtl
  );

  const clippingPlanes = useControlClipPlanes();

  const arrowTexture = useNodeIcon(solveNode.icons.arrow, OPTION_BUTTON_ICONS.arrow);
  const arrowSize = useMemo(() => optionButtonArrowSize(solveNode), [solveNode]);

  // The selected item's text and icon only, never the popup's full list (`option_button.cpp:423-424`).
  const selectedItem = selectedOptionItem(props);
  const text = selectedItem?.text ?? '';
  const iconTexture = useIconRefTexture(solveNode, selectedItem?.icon);
  const iconSize = ownButtonIconSize(solveNode);
  const iconModulate = useIconModulate(buttonIconColor(solveNode.colors, state), tint.own);
  const { fontSizePx, color: baseFontColor } = optionButtonTextTheme(solveNode, props, state, { theme });
  const tintedFontColor = useMemo(() => tintColor(baseFontColor, tint.own), [baseFontColor, tint.own]);
  const textOutline = useTintedTextOutline(solveNode, tint.own);

  const bidi = useControlBidiOptions(props, solveNode);
  const arrowMargin = solveNode.constants.arrow_margin ?? theme.separation;

  const facts = useMemo(
    () => optionButtonContentFacts(solveNode, props, text, { theme }, { x: rect.w, y: rect.h }, iconSize),
    [solveNode, props, text, theme, rect.w, rect.h, iconSize]
  );
  const layout = useWrappingButtonLabelLayout(
    solveNode,
    props,
    { themeFontKey: OPTION_BUTTON_THEME_FONT_KEY, text, fontSizePx, bidi },
    facts
  );

  const content = useMemo(
    () =>
      layoutOptionButtonContent({
        // The height sums independently ceiled ascent and descent and an integral spacing.
        content: { ...facts, textNaturalSize: labelNaturalSize(layout), isTextRtl: infersRtl(layout) },
        arrowSize,
        arrowMargin,
      }),
    [facts, layout, arrowSize, arrowMargin]
  );

  return (
    <>
      {/* `Button::_notification`'s `if (!flat)` (`button.cpp:216`), inherited,
          and the only thing `flat` changes: the minimum size still carries the
          stylebox's margins (`:525`). */}
      {!props.flat && (
        <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      )}
      {content.icon && (
        <PositionedIcon
          rect={content.icon.rect}
          texture={iconTexture}
          color={iconModulate.color}
          opacity={iconModulate.opacity}
          renderOrder={renderOrder}
        />
      )}
      {content.labelBox && layout && (
        <ButtonLabel
          layout={layout}
          overrunBehavior={props.overrunBehavior}
          bidi={bidi}
          isWrapped={isButtonAutowrapped(props)}
          box={content.labelBox}
          fontSizePx={fontSizePx}
          tint={tintedFontColor}
          outline={textOutline}
          clippingPlanes={clippingPlanes}
          renderOrder={renderOrder}
        />
      )}
      <PositionedIcon
        rect={content.arrowRect}
        texture={arrowTexture}
        color={tint.color}
        opacity={tint.opacity}
        renderOrder={renderOrder}
      />
    </>
  );
}
