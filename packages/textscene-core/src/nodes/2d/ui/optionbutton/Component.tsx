/**
 * `<OptionButton>`, the native painter: what Button draws for the selected item, then the arrow over it
 * (`option_button.cpp:91-135`).
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { OPTION_BUTTON_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { ButtonOverlayIcon, ButtonPainter } from '../button/Component';
import { OPTION_BUTTON_CLASS, optionButtonArrowColor, optionButtonArrowRect } from './nativeSolver';

/** The arrow `OptionButton::_notification` draws after Button's own draw. */
function OptionButtonArrow({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const arrowRect = useMemo(
    () => optionButtonArrowRect(solveNode, theme, { x: rect.w, y: rect.h }),
    [solveNode, theme, rect.w, rect.h]
  );
  return (
    <ButtonOverlayIcon
      rect={arrowRect}
      texture={useNodeIcon(solveNode.icons.arrow, OPTION_BUTTON_ICONS.arrow)}
      color={optionButtonArrowColor(solveNode)}
      tint={tint.own}
      renderOrder={renderOrder}
    />
  );
}

export function OptionButton(props: NativeControlComponentProps) {
  return (
    <>
      <ButtonPainter {...props} buttonClass={OPTION_BUTTON_CLASS} />
      <OptionButtonArrow {...props} />
    </>
  );
}
